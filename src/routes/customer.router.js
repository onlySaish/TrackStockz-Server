import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { 
    addCustomer,
    // blackListCustomer,
    getAllCustomers,
    // removeFromBlackList,
    toggleBlacklistCustomer,
    updateCustomerDetails
} from "../controllers/customer.controller.js";

const router = Router();

router.use(verifyJWT);
router.route("/add-customer").post(addCustomer);
router.route("/getCustomers").get(getAllCustomers);
router.route("/update-customer/:customerId").patch(updateCustomerDetails);
// router.route("/blacklist-customer/:customerId").patch(blackListCustomer);
// router.route("/remove-from-blacklist/:customerId").patch(removeFromBlackList);
router.route("/toggle-blacklist-customer/:customerId").patch(toggleBlacklistCustomer);


export default router;
