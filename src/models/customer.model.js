import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'
import mongoosePaginate from 'mongoose-aggregate-paginate-v2'

const customerSchema = new Schema(
    {
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        firstName: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        lastName: {
            type: String,
            required: true,
            trim: true,
            index: true,
            default: ""
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        phoneNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        address: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: String
        },
        companyName: {
            type: String,
            trim: true
        },
        blackListed: {
            type: Boolean,
            default: false
        }
    }
,{timestamps:true});

customerSchema.plugin(mongooseAggregatePaginate,mongoosePaginate);

export const Customer = mongoose.model("Customer",customerSchema);