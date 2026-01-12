import mongoose, { Schema } from "mongoose";

const membershipSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true
    },
    role: {
      type: String,
      enum: ["Owner", "Admin", "Member", "Viewer"],
      default: "Member",
      required: true
    },
    status: {
      type: String,
      enum: ["Pending", "Active"],
      default: "Active"
    }
  },
  { timestamps: true }
);

// Prevent duplicate memberships for same user in same org
membershipSchema.index({ user: 1, organization: 1 }, { unique: true });

export const Membership = mongoose.model("Membership", membershipSchema);
