import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
    createProduct,
    getAllCategories,
    getAllProducts,
    getAllSuppliers,
    toggleDeleteProduct,
    toggleProductStatus,
    updateCoverImg,
    updatePhotos,
    updatePrice,
    updateProductDetails, 
} from "../controllers/product.controller.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.use(verifyJWT);
router.route("/").get(getAllProducts)
    
router.route("/addProduct").post(upload.fields([
        {
            name: "coverImg",
            maxCount: 1    
        },
        {
            name: "photos",
            maxCount: 3
        }
    ]), createProduct);

router.route("/:productId")
    .put(updateProductDetails)
    .delete(toggleDeleteProduct);

router.route("/coverImg/:productId").put(upload.single("coverImg"),updateCoverImg);
router.route("/photos/:productId").put(upload.fields([
    {
        name: "photos",
        maxCount: 3
    }
]), updatePhotos);
router.route("/price/:productId").put(updatePrice);
router.route("/categories").get(getAllCategories);
router.route("/suppliers").get(getAllSuppliers);
router.route("/status/:productId").put(toggleProductStatus);

export default router;