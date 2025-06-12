import { Order } from '../models/orders.model.js';
import { Product } from '../models/product.model.js';
import { Customer } from '../models/customer.model.js';
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isValidObjectId } from 'mongoose';
import mongoose from 'mongoose';

// Add Order with Discount Calculation
const addOrder = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const { customerId, products, paymentMethod, additionalDiscountPercent = 0 } = req.body;
    if (!(customerId && isValidObjectId(customerId))) {throw new ApiError(400,"Customer is Required")}

    // Validate customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
        throw new ApiError(400,"Customer is Required");
    }

    // Validate products and calculate total and discounted price
    let totalPrice = 0;
    let discountedPrice = 0;
    const productList = [];

    for (const item of products) {            
      const product = await Product.findById(item.product);
      if (!product) {
        throw new ApiError(400,`Product with ID ${item.product} not found`);
      }
      if (product.quantity < item.quantity) {
        throw new ApiError(400,`Insufficient stock for ${product.name}`);
      }

      // Calculate actual and discounted prices
      const itemTotalPrice = item.quantity * product.price[0].price;
      const itemDiscount = (product.discountPercent / 100) * itemTotalPrice;
      const itemDiscountedPrice = itemTotalPrice - itemDiscount;

      totalPrice += itemTotalPrice;
      discountedPrice += itemDiscountedPrice;

      productList.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price[0].price,
      });

      // Update product stock
      product.quantity -= item.quantity;
      await product.save();
    }

    const finalDiscountedPrice = discountedPrice - ( (additionalDiscountPercent/100) * discountedPrice);
    // Create the order with both prices
    const order = await Order.create({
      owner: new mongoose.Types.ObjectId(userId),
      customer: customerId,
      products: productList,
      totalPrice,
      initialDiscountedPrice: discountedPrice,
      additionalDiscountPercent,
      finalDiscountedPrice,
      paymentMethod,
    });

    res.status(200).
    json(
        new ApiResponse(
            200,order,
            "Order Created Successfully"
        )
    );
});

const getAllOrders = asyncHandler(async (req, res) => {
  try {
      const userId = req.user._id;

      let { page = 1, limit = 5, sort = "createdAt", order = "asc", search = "", status = "", paymentMethod = "" } = req.query;
      
      page = parseInt(page);
      limit = parseInt(limit);
      const skip = (page - 1) * limit;

      // Default filter
      let matchConditions = [{owner: userId}];

      if (status !== "") {
          matchConditions.push({ status });
      }

      if (paymentMethod !== "") {
          matchConditions.push({ paymentMethod });
      }

      // let matchStage = { $match: matchConditions.length ? { $and: matchConditions } : {} };
      let matchStage = {
        $match: {
            $and: matchConditions
        }
      };


      // let matchStage2 = {};
      // // Apply search filter if provided
      // if (search) {
      //     matchStage2.$match.$or = [
      //         { 'customer.name': { $regex: search, $options: "i" } },
      //         { status: { $regex: search, $options: "i" } },
      //         { paymentMethod: { $regex: search, $options: "i" } },
      //     ];
      // }

      // Sorting logic
      const sortOrder = order === "desc" ? -1 : 1;

      const result = await Order.aggregate([
          matchStage,
          {
              $lookup: {
                  from: 'customers',
                  localField: 'customer',
                  foreignField: '_id',
                  as: 'customerDetails'
              }
          },
          {
              $unwind: "$customerDetails"
          },
          {
              $lookup: {
                  from: 'products',
                  localField: 'products.product',
                  foreignField: '_id',
                  as: 'productDetails',
                  pipeline: [
                    {
                      $project: {
                        _id:1,
                        coverImg:1, 
                        name:1,
                        discountPercent:1, 
                        price:1,
                        quantity:1 
                      }
                    }
                  ]
              }
          },
          { $sort: { [sort]: sortOrder } },
          { $skip: skip },
          { $limit: limit },
          {
              $project: {
                  customerDetails: 1,
                  products: 1,
                  productDetails: 1,
                  totalPrice: 1,
                  initialDiscountedPrice: 1,
                  additionalDiscountPercent: 1,
                  finalDiscountedPrice: 1,
                  paymentMethod: 1,
                  status: 1,
                  createdAt: 1,
                  updatedAt: 1
              }
          }
      ]);
      
      const searchOrders = (orders, query) => {
        // Convert query to lowercase for case-insensitive search
        const lowerCaseQuery = query.toLowerCase();
      
        return orders.filter(order => {
          // Search in customer details
          const customer = order.customerDetails;
          return (
            customer.firstName.toLowerCase().includes(lowerCaseQuery) ||
            customer.lastName.toLowerCase().includes(lowerCaseQuery) ||
            customer.companyName.toLowerCase().includes(lowerCaseQuery)
          );
        });
      };

      const filteredOrders = searchOrders(result, search);

      const totalOrders = await Order.countDocuments(matchStage.$match);

      res.status(200).json(
        new ApiResponse(
          200,
          {
            orders: filteredOrders,
            totalPages: Math.ceil(totalOrders / limit),
            currentPage: page,
            totalOrders,
          },
          "Fetched Orders Successfully"
        )
      );
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});

const editOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { products, additionalDiscountPercent = 0 } = req.body;
  

  if (!isValidObjectId(orderId)) {
    throw new ApiError(400, "Invalid Order ID");
  }

  // Fetch the order
  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Restore previous product quantities
  for (const item of order.products) {
    const product = await Product.findById(item._id);
    if (product) {
      product.quantity += item.quantity;
      await product.save();
    }
  }

  // Validate and update products
  let totalPrice = 0;
  let discountedPrice = 0;
  const productList = [];

  for (const item of products) {
    const product = await Product.findById(item._id);
    if (!product) {
      throw new ApiError(400, `Product with ID ${item._id} not found`);
    }
    if (product.quantity < item.quantity) {
      throw new ApiError(400, `Insufficient stock for ${product.name}`);
    }

    const itemTotalPrice = item.quantity * product.price[0].price;
    const itemDiscount = (product.discountPercent / 100) * itemTotalPrice;
    const itemDiscountedPrice = itemTotalPrice - itemDiscount;

    totalPrice += itemTotalPrice;
    discountedPrice += itemDiscountedPrice;

    productList.push({
      product: product._id,
      quantity: item.quantity,
      price: product.price[0].price,
    });

    // Update product stock
    product.quantity -= item.quantity;
    await product.save();
  }

  const finalDiscountedPrice = discountedPrice - ( (additionalDiscountPercent / 100) * discountedPrice);

  // Update order details
  order.products = productList;
  order.totalPrice = totalPrice;
  order.initialDiscountedPrice = discountedPrice;
  order.additionalDiscountPercent = additionalDiscountPercent;
  order.finalDiscountedPrice = finalDiscountedPrice;

  await order.save();

  res.status(200).json(new ApiResponse(200, order, "Order Updated Successfully"));
});

const updateStatus = asyncHandler(async (req,res) => {
  const { orderId } = req.params;
  const { status = "Pending" } = req.body;

  if (!(orderId && isValidObjectId(orderId))) {throw new ApiError(400, "Invalid Order ID")}
  const updatedOrder = await Order.findByIdAndUpdate(orderId, {
    $set: {
      status: status
    }
  })

  if (!updatedOrder) {throw new ApiError(400, "Order Not Found")};
  res.status(200)
  .json(
    new ApiResponse(
      200, updatedOrder,
      "Order Status Updated Successfully"
    )
  )
})

export {
    addOrder,
    getAllOrders,
    editOrder,
    updateStatus
}