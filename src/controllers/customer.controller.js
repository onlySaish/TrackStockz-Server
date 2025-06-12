import mongoose, { isValidObjectId, Mongoose } from "mongoose";
import { Customer } from "../models/customer.model.js"
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const addCustomer = asyncHandler(async(req,res) => {
    const userId = req.user._id;
    const {firstName, lastName, email, phoneNumber, address, companyName} = req.body;

    if (!(email && firstName && phoneNumber)) {throw new ApiError(404, "All Fields are Required")};

    const existingCustomer = await Customer.findOne({$or: [{email:email},{phoneNumber:phoneNumber}]});
    if (existingCustomer) {throw new ApiError(400,"User Already Exists")};

    const customerAddress = {
        street: address?.street || "",
        city: address?.city || "",
        state: address?.state || "",
        zipCode: address?.zipCode || "",
        country: address?.country || ""
    };

    const customer = await Customer.create({
        owner: new mongoose.Types.ObjectId(userId),
        firstName: firstName,
        lastName: lastName || "",
        email: email,
        phoneNumber: phoneNumber,
        address: customerAddress || null,
        companyName: companyName || null,
    })

    const createdCustomer = await Customer.findById(customer._id);
    if (!createdCustomer) {throw new ApiError(500,"Something went Wrong will adding Customer")};

    res.status(200)
    .json(
        new ApiResponse(
            200, createdCustomer,
            "Customer Added Successfully"
        )
    )
})

const updateCustomerDetails = asyncHandler(async(req,res) => {
    const {customerId} = req.params;
    if (!(customerId && isValidObjectId(customerId))) {"Invalid Customer"};

    const {firstName, lastName, phoneNumber,address, companyName} = req.body;
    
    if (!(firstName && phoneNumber)) {throw new ApiError(404, "All Fields are Required")};

    const customerAddress = {
        street: address?.street || "",
        city: address?.city || "",
        state: address?.state || "",
        zipCode: address?.zipCode || "",
        country: address?.country || ""
    };

    const customer = await Customer.findByIdAndUpdate(customerId,
        {
            $set: {
                firstName: firstName,
                lastName: lastName || "",
                phoneNumber: phoneNumber,
                address: customerAddress || null,
                companyName: companyName || null,
            }
        }, {new: true}
    )

    if (!customer) {throw new ApiError(400, "Customer Not Found")};

    res.status(200)
    .json(
        new ApiResponse(
            200, customer,
            "Customer Updated Successfully"
        )
    )
})

// const blackListCustomer = asyncHandler(async(req,res) => {
//     const {customerId} = req.params;
//     if (!(customerId && isValidObjectId(customerId))) {throw new ApiError(404, "Customer Not Found")};

//     const customer = await Customer.findByIdAndUpdate(customerId,
//         {
//             $set: {
//                 blackListed : true,
//             }
//         }, {new: true})
//     if (!customer) {throw new ApiError(404, "Customer Not Found")};

//     res.status(200)
//     .json(
//         new ApiResponse(
//             200, customer,
//             "Successfully Added to Blacklist"
//         )
//     )
// })

// const removeFromBlackList = asyncHandler(async(req,res) => {
//     const {customerId} = req.params;
//     if (!(customerId && isValidObjectId(customerId))) {throw new ApiError(404, "Email is Required")};

//     const customer = await Customer.findByIdAndUpdate(customerId,
//         {
//             $set: {
//                 blackListed : false,
//             }
//         },{new: true})
//     if (!customer) {throw new ApiError(404, "Customer Not Found")};

//     res.status(200)
//     .json(
//         new ApiResponse(
//             200, customer,
//             "Successfully Removed from Blacklist"
//         )
//     )
// })

const toggleBlacklistCustomer = asyncHandler(async (req, res) => {
    const { customerId } = req.params;
    if (!(customerId && isValidObjectId(customerId))) {
        throw new ApiError(404, "Customer Not Found");
    }

    // Find customer to check current blackListed status
    const customer = await Customer.findById(customerId);
    if (!customer) {
        throw new ApiError(404, "Customer Not Found");
    }

    // Toggle the blackListed field
    customer.blackListed = !customer.blackListed;
    await customer.save();

    res.status(200).json(
        new ApiResponse(
            200,
            customer,
            customer.blackListed
                ? "Successfully Added to Blacklist"
                : "Successfully Removed from Blacklist"
        )
    );
});


const getAllCustomers = asyncHandler(async (req, res) => {
    try {
        const userId = req.user._id;
        let { page = 1, limit = 5, sort = "createdAt", order = "asc", search = "", blacklist = "false" } = req.query;
        
        page = parseInt(page);
        limit = parseInt(limit);
        const skip = (page - 1) * limit;
        const isBlackListed = blacklist === "true";
        // Default filter
        let matchStage = { $match: { blackListed: isBlackListed, owner: userId } };

        // Apply search filter if provided
        if (search) {
            matchStage.$match.$or = [
                { firstName: { $regex: search, $options: "i" } },
                { lastName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phoneNumber: { $regex: search, $options: "i" } },
                { companyName: { $regex: search, $options: "i" } },
            ];
        }

        // Sorting logic
        const sortOrder = order === "desc" ? -1 : 1;
    
        const result = await Customer.aggregate([
            matchStage,  // Filtering stage
            { $sort: { [sort]: sortOrder } }, // Apply sorting
            { $skip: skip }, // Skip documents for pagination
            { $limit: limit }, // Limit results per page
            { 
                $project: { // Select required fields
                    firstName: 1, 
                    lastName: 1, 
                    email: 1, 
                    phoneNumber: 1, 
                    address: 1, 
                    companyName: 1,
                }
            }
        ]);

        
        let customers, totalCustomers,currentPage;
        if (result.length === 0){
            customers = [];
            totalCustomers = 0;
            currentPage = 1;
        } else {
            customers = result;
            const result2 = await Customer.aggregate([matchStage]);
            totalCustomers = result2.length;
            currentPage = page;
        }

        res.status(200).json(
            new ApiResponse(
                200, 
                {
                    customers,
                    totalPages: Math.ceil(totalCustomers / limit),
                    currentPage: currentPage,
                    totalCustomers,
                },
                "Fetched Customers Successfully"
            )
        );
    } catch (error) {
        console.error(error);
    }
});


export { 
    addCustomer,
    getAllCustomers,
    updateCustomerDetails,
    // blackListCustomer,
    // removeFromBlackList,
    toggleBlacklistCustomer
}