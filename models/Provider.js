import mongoose from "mongoose";

const providerSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  verticalId: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, required: true }, // 'restaurant', 'dealer', 'landlord', etc.
  address: { type: String },
  phone: { type: String },
  email: { type: String },
  rating: { type: Number, default: 0 },
  logoUrl: { type: String },
  bannerUrl: { type: String },
  country: { type: String },
  ownerLogin: { type: String }, // email of provider owner
  active: { type: Boolean, default: true },
  metadata: { type: mongoose.Schema.Types.Mixed }, // flexible fields per provider type
  
  // Legacy restaurant fields for backward compatibility
  cuisine: { type: mongoose.Schema.Types.Mixed },
  logoImage: { type: Buffer },
  logoImageType: { type: String },
  brandImage: { type: Buffer },
  brandImageType: { type: String },
  brandUrl: { type: String }
}, { timestamps: true });

// Ensure id auto-increment logic is handled elsewhere or use mongoose-sequence
export default mongoose.model("Provider", providerSchema);
