import mongoose from "mongoose";

const listingSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  verticalId: { type: String, required: true },
  providerId: { type: Number, required: true },
  providerType: { type: String },
  title: { type: String, required: true },
  description: { type: String },
  category: { type: String },
  subcategory: { type: String },
  
  // Generic attributes object - keys depend on vertical
  attributes: { type: mongoose.Schema.Types.Mixed },
  additionalAttributes: { type: mongoose.Schema.Types.Mixed },
  
  // Pricing structure
  pricing: {
    originalPrice: { type: Number },
    discountedPrice: { type: Number },
    currency: { type: String, default: 'QAR' },
    unit: { type: String } // e.g., 'night', 'day', 'session'
  },
  
  // Validity/Expiry
  validity: {
    from: { type: Date },
    to: { type: Date }
  },
  
  // Location info
  location: {
    city: { type: String },
    country: { type: String },
    address: { type: String }
  },
  
  // Media items
  imageUrl: { type: String },
  galleryUrls: [{ type: String }],
  
  // Status and visibility
  status: { type: String, enum: ['active', 'inactive', 'pending', 'archived'], default: 'pending' },
  active: { type: Boolean, default: false },
  
  // Original fields for backward compatibility with Offer
  restaurantId: { type: Number },
  cuisine: { type: String },
  offerType: { type: String },
  validFrom: { type: Date },
  validTo: { type: Date },
  originalPrice: { type: Number },
  discountedPrice: { type: Number },
  
  // Metadata
  rating: { type: Number, default: 0 },
  reviewsCount: { type: Number, default: 0 },
  ownerLogin: { type: String },
  enquiryClicks: { type: Number, default: 0 }
}, { timestamps: true });

// ⚡ Indexes for performance
listingSchema.index({ verticalId: 1, active: 1 });
listingSchema.index({ providerId: 1 });
listingSchema.index({ category: 1 });
listingSchema.index({ verticalId: 1, subcategory: 1, active: 1 });
listingSchema.index({ "location.city": 1 });

export default mongoose.model("Listing", listingSchema);
