import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  createOrganization,
  getUserOrganizations,
  getOrganizationMembers,
  addMember,
  joinOrganization,
  removeMember
} from "../controllers/organization.controller.js";

const router = Router();
router.use(verifyJWT);

router.route("/").get(getUserOrganizations).post(createOrganization);
router.route("/join").post(joinOrganization);
router.route("/:organizationId/members").get(getOrganizationMembers).post(addMember);
router.route("/:organizationId/members/:memberId").delete(removeMember);

export default router;
