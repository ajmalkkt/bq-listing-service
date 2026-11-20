import mongoose from "mongoose";

const favoriteDigestDeliverySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  windowKey: { type: String, required: true },
  status: { type: String, required: true, enum: ["processing", "sent", "failed"], default: "processing" },
  leaseUntil: { type: Date },
  attempts: { type: Number, default: 1 },
  sentAt: { type: Date },
  error: { type: String, maxlength: 500 },
}, { timestamps: true });

favoriteDigestDeliverySchema.index(
  { userId: 1, windowKey: 1 },
  { unique: true, name: "favorite_digest_user_window_unique" }
);
favoriteDigestDeliverySchema.index({ status: 1, leaseUntil: 1 }, { name: "favorite_digest_lease" });

export default mongoose.model("FavoriteDigestDelivery", favoriteDigestDeliverySchema);
