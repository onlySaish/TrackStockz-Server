import mongoose from "mongoose";
import { Organization } from "../models/organization.model.js";
import { Membership } from "../models/membership.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createOrganization = asyncHandler(async (req, res) => {
  const { name, slug } = req.body;

  if (!name || !slug) {
    throw new ApiError(400, "Name and Slug are required");
  }

  const existingOrg = await Organization.findOne({ slug });
  if (existingOrg) {
    throw new ApiError(409, "Organization with this slug already exists");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Generate random invite code
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const organization = await Organization.create([{
      name,
      slug,
      owner: req.user._id,
      inviteCode
    }], { session });

    await Membership.create([{
      user: req.user._id,
      organization: organization[0]._id,
      role: "Owner",
      status: "Active"
    }], { session });

    await session.commitTransaction();

    res.status(201).json(
      new ApiResponse(201, organization[0], "Organization created successfully")
    );
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

const getUserOrganizations = asyncHandler(async (req, res) => {
  const memberships = await Membership.find({ user: req.user._id, status: "Active" })
    .populate("organization");

  const organizations = memberships
    .map(m => {
      if (!m.organization) return null;
      const org = m.organization.toObject ? m.organization.toObject() : m.organization;
      return { ...org, role: m.role }; // Attach role to organization
    })
    .filter(org => org !== null);

  res.status(200).json(
    new ApiResponse(200, organizations, "User organizations fetched successfully")
  );
});

const getOrganizationMembers = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  const membership = await Membership.findOne({
    user: req.user._id,
    organization: organizationId,
    status: "Active"
  });

  if (!membership) {
    throw new ApiError(403, "You are not a member of this organization");
  }

  const members = await Membership.find({ organization: organizationId })
    .populate("user", "fullName email avatar username");

  res.status(200).json(
    new ApiResponse(200, members, "Organization members fetched successfully")
  );
});

const addMember = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const { email, role } = req.body;

  // Check if requester is admin/owner
  const requesterMembership = await Membership.findOne({
    user: req.user._id,
    organization: organizationId,
    status: "Active"
  });

  if (!requesterMembership || !["Owner", "Admin"].includes(requesterMembership.role)) {
    throw new ApiError(403, "You do not have permission to add members");
  }

  const userToAdd = await User.findOne({ email });
  if (!userToAdd) {
    throw new ApiError(404, "User not found with this email");
  }

  const existingMembership = await Membership.findOne({
    user: userToAdd._id,
    organization: organizationId
  });

  if (existingMembership) {
    throw new ApiError(409, "User is already a member of this organization");
  }

  const newMembership = await Membership.create({
    user: userToAdd._id,
    organization: organizationId,
    role: role || "Member",
    status: "Active" // For simplicity, auto-activate. In real app, might want invite flow.
  });

  res.status(201).json(
    new ApiResponse(201, newMembership, "Member added successfully")
  );
});

const joinOrganization = asyncHandler(async (req, res) => {
  const { inviteCode } = req.body;

  if (!inviteCode) {
    throw new ApiError(400, "Invite Code is required");
  }

  const organization = await Organization.findOne({ inviteCode });
  if (!organization) {
    throw new ApiError(404, "Invalid Invite Code");
  }

  const existingMembership = await Membership.findOne({
    user: req.user._id,
    organization: organization._id
  });

  if (existingMembership) {
    throw new ApiError(409, "You are already a member of this organization");
  }

  const newMembership = await Membership.create({
    user: req.user._id,
    organization: organization._id,
    role: "Member",
    status: "Active"
  });

  res.status(200).json(
    new ApiResponse(200, { membership: newMembership, organization }, "Joined organization successfully")
  );
});

const removeMember = asyncHandler(async (req, res) => {
  const { organizationId, memberId } = req.params;

  // 1. Check if requester is Owner/Admin of the organization
  const requesterMembership = await Membership.findOne({
    user: req.user._id,
    organization: organizationId,
    status: "Active"
  });

  if (!requesterMembership || !["Owner", "Admin"].includes(requesterMembership.role)) {
    throw new ApiError(403, "You do not have permission to remove members");
  }

  // 2. Find the membership to remove
  const membershipToRemove = await Membership.findOne({
    user: memberId,
    organization: organizationId
  });

  if (!membershipToRemove) {
    throw new ApiError(404, "Member not found in this organization");
  }

  // 3. Prevent removing self if Owner (Optional specific logic, but generally allowed if not the *only* owner, but simpler to just allow or block self-removal entirely depending on reqs. Standard: You can leave, but removing self via 'removeMember' usually implies kicking someone else. Let's allow removing others.)
  if (requesterMembership.user.toString() === membershipToRemove.user.toString()) {
    // If owner tries to remove themselves, they should use 'leave' endpoint (not implemented yet) or we allow it.
    // For now, let's block it to prevent accidental lockout/deletion via this specific route intended for management.
    throw new ApiError(400, "You cannot remove yourself using this feature.");
  }

  // 4. Check hierarchy: Admin cannot remove Owner.
  if (requesterMembership.role === "Admin" && membershipToRemove.role === "Owner") {
    throw new ApiError(403, "Admins cannot remove Owners");
  }

  await Membership.findByIdAndDelete(membershipToRemove._id);

  res.status(200).json(
    new ApiResponse(200, {}, "Member removed successfully")
  );
});

export {
  createOrganization,
  getUserOrganizations,
  getOrganizationMembers,
  addMember,
  joinOrganization,
  removeMember
};
