import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'
import mongoosePaginate from 'mongoose-aggregate-paginate-v2'

const productSchema = new Schema(
    {
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        organization: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        description: {
            type: String,
            trim: true
        },
        price: [
            {
                date: {
                    type: Date,
                    required: true,
                    default: Date.now
                },
                price: {
                    type: Number,
                    required: true,
                    min: 0
                }
            }
        ],
        quantity: {
            type: Number,
            required: true,
            min: 0
        },
        category: {
            type: String,
            required: true
        },
        supplier: {
            type: String,
            trim: true
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        status: {
            type: String,
            enum: ['Active', 'Inactive'],
            default: 'Active'
        },
        lowStockThreshold: {
            type: Number,
            default: 10
        },
        discountPercent: {
            type: Number,
            default: 0,
            min: 0
        },
        sku: {          //Barcode
            type: String,
            unique: true,
            trim: true,
            default: Date.now
        },
        coverImg: {
            type: String,   //cloudinary url
            required: true
        },
        photos: [
            { type: String }
        ],
    }, { timestamps: true }
)


productSchema.plugin(mongooseAggregatePaginate, mongoosePaginate);

export const Product = mongoose.model("Product", productSchema);