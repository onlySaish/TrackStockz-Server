import { Order } from '../models/orders.model.js';
import { Product } from '../models/product.model.js';
import { Customer } from '../models/customer.model.js';
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Membership } from '../models/membership.model.js';
import mongoose, { isValidObjectId } from 'mongoose';

const getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { organizationId } = req.query;

  if (!organizationId) {
    throw new ApiError(400, "Organization ID is required");
  }

  // Verify membership
  const membership = await Membership.findOne({ user: userId, organization: organizationId, status: "Active" });
  if (!membership) {
    throw new ApiError(403, "You are not a member of this organization");
  }

  const totalCustomers = await Customer.countDocuments({ organization: organizationId });
  const totalProducts = await Product.countDocuments({ organization: organizationId });
  const totalOrders = await Order.countDocuments({ organization: organizationId })

  // Fetch total revenue
  const totalRevenue = await Order.aggregate([
    { $match: { organization: new mongoose.Types.ObjectId(organizationId) } },
    { $group: { _id: null, revenue: { $sum: "$finalDiscountedPrice" } } }
  ]);
  const revenue = totalRevenue.length ? totalRevenue[0].revenue : 0

  // Get pending orders count
  const pendingOrders = await Order.countDocuments({ status: "Pending", organization: organizationId })
  const completedOrders = await Order.countDocuments({ status: "Completed", organization: organizationId })
  const cancelledOrders = await Order.countDocuments({ status: "Cancelled", organization: organizationId })

  // Get low stock products (threshold: < 10)
  const lowStockCount = await Product.countDocuments({
    $expr: { $lte: ["$quantity", "$lowStockThreshold"] }, organization: organizationId
  });

  // Get recent orders (last 5)
  const recentOrders = await Order.find({ organization: organizationId })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("customer", "firstName lastName")
  // Fetch monthly sales trends from actual orders data

  const salesTrends = await Order.aggregate([
    { $match: { organization: new mongoose.Types.ObjectId(organizationId) } },
    {
      $group: {
        _id: { $month: "$createdAt" }, // Group by month
        totalRevenue: { $sum: "$finalDiscountedPrice" }
      }
    },
    { $sort: { _id: 1 } } // Sort by month
  ])

  // Convert month numbers to readable month names
  const monthsMap = {
    1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
    7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec"
  }
  const formattedSalesTrends = salesTrends.map(item => ({
    month: monthsMap[item._id],
    revenue: item.totalRevenue
  }))

  res.status(200).json(
    new ApiResponse(
      200,
      {
        stats: {
          totalCustomers,
          totalProducts,
          totalOrders,
          totalRevenue: revenue,
          pendingOrders,
          completedOrders,
          cancelledOrders,
          lowStockCount,
          salesTrends: formattedSalesTrends
        },
        recentOrders: recentOrders.map(order => ({
          id: order._id,
          customer: `${order.customer?.firstName || "Unknown"} ${order.customer?.lastName || ""}`.trim(),
          totalPrice: order.finalDiscountedPrice,
          status: order.status
        }))
      },
      "Dashboard Stats Fetched Successfully"
    )
  );
});

export {
  getDashboardStats
}