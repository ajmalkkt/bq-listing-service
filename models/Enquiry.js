import mongoose from "mongoose";

const enquirySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: false,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["NEW", "IN_PROGRESS", "RESOLVED", "SEND_FAILED"],
      default: "NEW",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    ownerLogin: { type: String },//email of restaurant owner
  },
  { collection: "enquiries" }
);

export default mongoose.model("Enquiry", enquirySchema);
