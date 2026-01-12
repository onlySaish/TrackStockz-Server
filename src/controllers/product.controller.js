import mongoose, { isValidObjectId } from 'mongoose';
import { Product } from '../models/product.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { deleteFromCloudinary, getPublicIdFromUrl, uploadOnCloudinary } from '../utils/cloudinary.js';
import { Membership } from '../models/membership.model.js';

// Create Product
// Create Product
const createProduct = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const { name, description, lowStockThreshold, category, price, discountPercent, quantity, supplier, organizationId } = req.body;
    if (!(name && description && lowStockThreshold && category && price && organizationId)) { throw new ApiError("Missing Required Fields") };

    // Verify membership
    const membership = await Membership.findOne({ user: userId, organization: organizationId, status: "Active" });
    if (!membership) {
        throw new ApiError(403, "You are not a member of this organization");
    }

    const coverImgLocalPath = req.files?.coverImg[0].path;
    if (!coverImgLocalPath) { throw new ApiError(404, "Cover Image not Found") };

    const coverImgFile = await uploadOnCloudinary(coverImgLocalPath);
    if (!coverImgFile) { throw new ApiError(500, "Cover Image Upload on Cloudinary Failed") };

    let photosFiles = [];
    if (req.files?.photos) {
        const photosPaths = req.files.photos.map(file => file.path);
        for (let path of photosPaths) {
            const uploadedPhoto = await uploadOnCloudinary(path);
            if (!uploadedPhoto) { throw new ApiError(500, "Photos Upload on Cloudinary Failed") };
            photosFiles.push(uploadedPhoto.secure_url);
        }
    }

    const product = await Product.create({
        owner: new mongoose.Types.ObjectId(userId),
        organization: new mongoose.Types.ObjectId(organizationId),
        name,
        description,
        coverImg: coverImgFile.secure_url,
        photos: photosFiles,
        lowStockThreshold,
        category,
        price: [{ price: price }],
        discountPercent,
        quantity,
        supplier: supplier || null
    });

    if (!product) { throw new ApiError(400, "Error Creating Product") };

    res.status(200)
        .json(
            new ApiResponse(
                200, product,
                "Product Added Successfully"
            )
        )
});

// Get All Products with Pagination and Filtering
const getAllProducts = asyncHandler(async (req, res) => {
    try {
        const userId = req.user._id;

        let { page = 1, limit = 5, sort = "createdAt", order = "asc", search = "", isDeleted = "false", category = "", status = "", organizationId } = req.query;

        if (!organizationId) {
            throw new ApiError(400, "Organization ID is required");
        }

        // Verify membership
        const membership = await Membership.findOne({ user: userId, organization: organizationId, status: "Active" });
        if (!membership) {
            throw new ApiError(403, "You are not a member of this organization");
        }

        page = parseInt(page);
        limit = parseInt(limit);
        const skip = (page - 1) * limit;
        const deletedFlag = isDeleted === "true";

        // Default filter
        // REMOVED owner: userId, switched to organization: organizationId
        let matchConditions = [{ isDeleted: deletedFlag, organization: new mongoose.Types.ObjectId(organizationId) }];

        if (category !== "") {
            matchConditions.push({ category: category });
        }

        if (status !== "") {
            matchConditions.push({ status: status });
        }

        let matchStage = {
            $match: {
                $and: matchConditions
            }
        };

        // Apply search filter if provided
        if (search) {
            matchStage.$match.$or = [
                { name: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { category: { $regex: search, $options: "i" } },
            ];
        }

        // Sorting logic
        const sortOrder = order === "desc" ? -1 : 1;

        const result = await Product.aggregate([
            matchStage, // Filtering stage
            { $sort: { [sort]: sortOrder } }, // Apply sorting
            { $skip: skip }, // Skip documents for pagination
            { $limit: limit }, // Limit results per page
            {
                $project: { // Select required fields
                    name: 1,
                    description: 1,
                    category: 1,
                    quantity: 1,
                    supplier: 1,
                    price: 1, // Get latest price only
                    coverImg: 1,
                    photos: 1,
                    status: 1,
                    lowStockThreshold: 1,
                    discountPercent: 1,
                    isDeleted: 1,
                }
            }
        ]);

        let products, totalProducts, currentPage;
        if (result.length === 0) {
            products = [];
            totalProducts = 0;
            currentPage = 1;
        } else {
            products = result;
            const result2 = await Product.aggregate([matchStage]);
            totalProducts = result2.length;
            currentPage = page;
        }

        res.status(200).json(
            new ApiResponse(
                200,
                {
                    products,
                    totalPages: Math.ceil(totalProducts / limit),
                    currentPage: currentPage,
                    totalProducts,
                },
                "Fetched Products Successfully"
            )
        );
    } catch (error) {
        console.error(error);
        if (error instanceof ApiError) throw error;
        throw new ApiError(500, "Internal Server Error");
    }
});

const getAllCategories = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { organizationId } = req.query;
    let categories = [];

    if (!organizationId) throw new ApiError(400, "Organization ID Required");

    // Verify membership
    const membership = await Membership.findOne({ user: userId, organization: organizationId, status: "Active" });
    if (!membership) {
        throw new ApiError(403, "You are not a member of this organization");
    }

    const products = await Product.find({ organization: organizationId });
    if (products.length === 0) {
        return res.status(200).json(new ApiResponse(200, [], "No Products Found"));
    }

    categories = [...new Set(products.map(product => product.category))];

    res.status(200)
        .json(
            new ApiResponse(
                200, categories,
                "Fetched All Categories"
            )
        );
})

const getAllSuppliers = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { organizationId } = req.query;
    let suppliers = [];

    if (!organizationId) throw new ApiError(400, "Organization ID Required");

    // Verify membership
    const membership = await Membership.findOne({ user: userId, organization: organizationId, status: "Active" });
    if (!membership) {
        throw new ApiError(403, "You are not a member of this organization");
    }

    const products = await Product.find({ organization: organizationId });
    if (products.length === 0) {
        return res.status(200).json(new ApiResponse(200, {}, "No Products Found"));
    }

    suppliers = [...new Set(products.map(product => product.supplier))];

    res.status(200)
        .json(
            new ApiResponse(
                200, suppliers,
                "Fetched All Suppliers"
            )
        );
})

//Update Price
const updatePrice = asyncHandler(async (req, res) => {
    try {
        const { productId } = req.params;
        const { newPrice } = req.body;

        if (!(productId && isValidObjectId(productId))) {
            throw new ApiError(400, "Invalid Product ID");
        }

        if (typeof newPrice !== 'number' || newPrice <= 0) {
            throw new ApiError(400, "Invalid Price. Please provide a valid number.");
        }

        const product = await Product.findById(productId);
        if (!product) {
            throw new ApiError(404, "Product Not Found");
        }

        // Update price only if it's different
        if (newPrice !== product.price[0].price) {
            product.price.unshift({ date: new Date(), price: newPrice });
            await product.save();
        }

        // Keep only 3 prices
        if (product.price.length > 3) {
            product.price.pop();
            await product.save();
        }

        res.status(200).json(new ApiResponse(200, product, "Product Updated Successfully"));
    } catch (error) {
        console.error(error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Internal Server Error",
        });
    }
});


// Update Product
const updateProductDetails = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    if (!(productId && isValidObjectId(productId))) { throw new ApiError(400, "Invalid Product ID") };

    const { name, description, status, lowStockThreshold, category, discountPercent, quantity, supplier } = req.body;
    if (!(name && description && status && lowStockThreshold && category)) { throw new ApiError("Missing Required Fields") };

    const updatedProduct = await Product.findByIdAndUpdate(productId,
        {
            $set: {
                name,
                description,
                status,
                lowStockThreshold,
                category,
                discountPercent,
                quantity,
                supplier: supplier || null
            }
        }, { new: true }
    )
    if (!updatedProduct) { throw new ApiError(400, "Product Not Found") };

    res.status(200)
        .json(
            new ApiResponse(
                200, updatedProduct,
                "Product Details Updated Successfully"
            )
        )
});

const updateCoverImg = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    if (!(productId && isValidObjectId(productId))) { throw new ApiError(400, "Invalid Product Id") };

    const product = await Product.findById(productId);
    if (!product) { throw new ApiError(400, "Product Not Found") }

    const coverImgLocalPath = req.file?.path;
    if (!coverImgLocalPath) { throw new ApiError(400, "Missing Cover Image") };

    const newCoverImg = await uploadOnCloudinary(coverImgLocalPath);
    if (!newCoverImg) { throw new ApiError(500, "Cover Image Upload on Cloudinary Failed") };

    const oldCoverImg = product.coverImg;

    const updatedProduct = await Product.findByIdAndUpdate(productId,
        {
            $set: {
                coverImg: newCoverImg.secure_url
            }
        }, { new: true }
    )

    if (!updatedProduct) { throw new ApiError(500, "Error Updating Product") };

    try {
        getPublicIdFromUrl(oldCoverImg)
            .then((value) => deleteFromCloudinary(value, "image"))
    } catch (error) {
        throw new ApiError(400, "Error Deleting old file from cloudinary")
    }

    res.status(200)
        .json(
            new ApiResponse(
                200, updatedProduct,
                "Cover Image Updated Successfully"
            )
        )
});

const updatePhotos = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    if (!(productId && isValidObjectId(productId))) { throw new ApiError(400, "Invalid Product Id") };

    const product = await Product.findById(productId);
    if (!product) { throw new ApiError(400, "Product Not Found") };

    let newPhotos = [];
    let oldPhotos = product.photos;

    if (req.files?.photos) {
        const photosPaths = req.files.photos.map(file => file.path);
        for (let path of photosPaths) {
            const uploadedPhoto = await uploadOnCloudinary(path);
            if (!uploadedPhoto) { throw new ApiError(500, "Photos Upload on Cloudinary Failed") };
            newPhotos.push(uploadedPhoto.secure_url);
        }
    }

    const updatedProduct = await Product.findByIdAndUpdate(productId,
        {
            $set: {
                photos: newPhotos
            }
        }, { new: true });
    if (!updatedProduct) { throw new ApiError(500, "Error Updating Product") };

    try {
        oldPhotos.forEach(async (photoUrl) => {
            getPublicIdFromUrl(photoUrl)
                .then((value) => deleteFromCloudinary(value, "image"))
        });
    } catch (error) {
        throw new ApiError(400, "Error Deleting old photos from cloudinary");
    }

    res.status(200).json(new ApiResponse(200, updatedProduct, "Photos Updated Successfully"));
});

const toggleProductStatus = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    if (!(productId && isValidObjectId(productId))) { throw new ApiError(400, "Invalid Product ID") };

    const product = await Product.findById(productId);
    if (!product) { throw new ApiError(400, "Product Not Found") };

    if (product.status === "Active") {
        product.status = "Inactive";
    } else {
        product.status = "Active";
    }
    await product.save();

    res.status(200)
        .json(
            new ApiResponse(
                200, product,
                "Product Updated Successfully"
            )
        )
})

const toggleDeleteProduct = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    if (!(productId && isValidObjectId(productId))) { throw new ApiError(400, "Invalid Product ID") };

    const product = await Product.findById(productId);
    if (!product) { throw new ApiError(400, "Product Not Found") };

    product.isDeleted = !product.isDeleted;
    await product.save();

    res.status(200)
        .json(
            new ApiResponse(
                200, product,
                "Product Updated Successfully"
            )
        )
});

export {
    createProduct,
    getAllProducts,
    updatePrice,
    updateProductDetails,
    updateCoverImg,
    updatePhotos,
    toggleProductStatus,
    toggleDeleteProduct,
    getAllCategories,
    getAllSuppliers
}