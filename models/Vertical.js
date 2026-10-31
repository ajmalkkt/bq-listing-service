import mongoose from "mongoose";

const verticalSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  enabled: { type: Boolean, default: false },
  description: { type: String },
  config: { type: mongoose.Schema.Types.Mixed }, // JSON storage for dynamic config
  icon: { type: String },
  color: { type: String },
  route: { type: String },
  providerTypes: [{ type: String }],
  subcategories: [{ type: String }],
  industries: [{ type: String }],
  filters: [{ type: mongoose.Schema.Types.Mixed }],
  additionalAttributes: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

export default mongoose.model("Vertical", verticalSchema);
