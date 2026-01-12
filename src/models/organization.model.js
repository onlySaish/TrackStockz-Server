import mongoose, { Schema } from "mongoose";

const organizationSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    inviteCode: {
      type: String,
      unique: true,
      index: true
    }
  },
  { timestamps: true }
);

export const Organization = mongoose.model("Organization", organizationSchema);
