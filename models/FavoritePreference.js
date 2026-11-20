import mongoose from "mongoose";

const favoritePreferenceSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  enabled: { type: Boolean, default: false },
  email: { type: String, lowercase: true, trim: true, maxlength: 254 },
  emailVerified: { type: Boolean, default: false },
  optedInAt: { type: Date },
  cadence: { type: String, enum: ["daily", "weekly", "monthly", "once"], default: "weekly" },
  oneTimeDate: { type: Date },
  categories: { type: [String], default: [] },
  timezone: { type: String, default: "Asia/Qatar" },
  endDate: { type: Date },
  lastDigestAt: { type: Date },
  nextDueAt: { type: Date, index: true },
  emailVerificationTokenHash: { type: String, select: false },
  emailVerificationExpiresAt: { type: Date, select: false },
}, { timestamps: true });

favoritePreferenceSchema.index(
  { enabled: 1, nextDueAt: 1 },
  { name: "favorite_preferences_due" }
);

export default mongoose.model("FavoritePreference", favoritePreferenceSchema);
