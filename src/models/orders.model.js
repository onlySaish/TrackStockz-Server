import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'
import mongoosePaginate from 'mongoose-aggregate-paginate-v2'

const orderSchema = new Schema({
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },
  organization: {
    type: Schema.Types.ObjectId,
    ref: "Organization",
    required: true
  },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
  products: [
    {
      product: { type: Schema.Types.ObjectId, ref: 'Product' },
      quantity: Number,
      price: Number,
    },
  ],
  totalPrice: Number,

  initialDiscountedPrice: Number,
  additionalDiscountPercent: Number,
  finalDiscountedPrice: Number,

  paymentMethod: String,
  status: { type: String, default: 'Pending' },
}, { timestamps: true }
);

orderSchema.plugin(mongooseAggregatePaginate, mongoosePaginate);
export const Order = mongoose.model("Order", orderSchema);