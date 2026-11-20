import mongoose from "mongoose";

const favoriteSnapshotSchema = new mongoose.Schema({
  title: { type: String, maxlength: 240 },
  name: { type: String, maxlength: 160 },
  category: { type: String, maxlength: 120 },
  imageUrl: { type: String, maxlength: 2048 },
  price: { type: Number },
  originalPrice: { type: Number },
  currency: { type: String, maxlength: 8, default: "QAR" },
  location: { type: String, maxlength: 180 },
}, { _id: false });

const notifiedStateSchema = new mongoose.Schema({
  price: { type: Number },
  currency: { type: String, maxlength: 8, default: "QAR" },
  available: { type: Boolean },
  checkedAt: { type: Date },
}, { _id: false });

const favoriteSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  source: { type: String, required: true, enum: ["listing", "offer"] },
  verticalId: { type: String, required: true, maxlength: 80 },
  itemId: { type: String, required: true, maxlength: 100 },
  snapshot: { type: favoriteSnapshotSchema, default: () => ({}) },
  lastNotified: { type: notifiedStateSchema, default: undefined },
}, { timestamps: true, minimize: true });

favoriteSchema.index(
  { userId: 1, source: 1, verticalId: 1, itemId: 1 },
  { unique: true, name: "favorite_owner_item_unique" }
);
favoriteSchema.index({ userId: 1, updatedAt: -1 }, { name: "favorite_owner_updated" });

export default mongoose.model("Favorite", favoriteSchema);
