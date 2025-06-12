import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
    addOrder,
    editOrder,
    getAllOrders,
    updateStatus,
} from "../controllers/order.controller.js";

const router = Router();

router.use(verifyJWT);
router.route("/")
    .post(addOrder)
    .get(getAllOrders);

router.route("/:orderId")
    .patch(editOrder)
    .put(updateStatus);

export default router;
