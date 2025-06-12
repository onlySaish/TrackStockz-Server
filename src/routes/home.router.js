import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getDashboardStats } from "../controllers/home.controller.js";

const router = Router()
router.use(verifyJWT);

router.route("/").get(getDashboardStats);

export default router;