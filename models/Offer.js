import mongoose from "mongoose";

const offerSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  title: { type: String, required: true },
  description: { type: String },
  restaurantId: { type: Number, required: true },
  cuisine: { type: String },
  originalPrice: { type: Number },
  discountedPrice: { type: Number },
  offerType: { type: String },
  validFrom: { type: Date },
  validTo: { type: Date },
  imageUrl: { type: String },
  location: { type: String },
  country: { type: String },
  category: { type: String },
  active: { type: Boolean, default: false },
  image: { type: Buffer },
  imageType: { type: String },
  restaurantName: { type: String },
  ownerLogin: { type: String },//email of restaurant owner
}, { timestamps: true });

// ⚡ Indexes for performance
offerSchema.index({ active: 1, validTo: 1 });
offerSchema.index({ active: 1, validTo: 1, cuisine: 1 });
offerSchema.index({ active: 1, validTo: 1, category: 1 });
// (Optional)
// offerSchema.index({ active: 1, validTo: 1, country: 1 });

export default mongoose.model("Offer", offerSchema);
