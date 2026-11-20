import mongoose from "mongoose";

const favoriteUnsubscribeTokenSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
}, { timestamps: true });

favoriteUnsubscribeTokenSchema.index({ userId: 1 }, { name: "favorite_unsubscribe_owner" });

export default mongoose.model("FavoriteUnsubscribeToken", favoriteUnsubscribeTokenSchema);
