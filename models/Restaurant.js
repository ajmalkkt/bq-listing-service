import mongoose from "mongoose";

const restaurantSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: { type: String, required: true },
  address: { type: String },
  phone: { type: String },
  rating: { type: Number, default: 0 },
  rank: { type: Number, default: 3 },
  cuisine: [{ type: String }],
  logoUrl: { type: String, required: true },
  brandUrl: { type: String },
  country: { type: String },
  logoImage: { type: Buffer },
  logoImageType: { type: String },
  brandImage: { type: Buffer },
  brandImageType: { type: String },
  ownerLogin: { type: String },//email of restaurant owner
  active: { type: Boolean, default: true },
  menuImages: [{ type: String }], // Array of GCS URLs for menu page images
}, { timestamps: true }); // timestamps: true will add createdAt and updatedAt fields

export default mongoose.model("Restaurant", restaurantSchema);
