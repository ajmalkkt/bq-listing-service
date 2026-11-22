import dotenv from "dotenv";
import Listing from "../models/Listing.js";
import Provider from "../models/Provider.js";
import { connectDB } from "../config/db.js";

dotenv.config();

await connectDB();

const listings = await Listing.find({});
let attributesUpdated = 0;
let phonesFilled = 0;

for (const listing of listings) {
  const legacy = listing.additionalAttributes && typeof listing.additionalAttributes === "object"
    ? listing.additionalAttributes
    : {};
  const canonical = listing.attributes && typeof listing.attributes === "object"
    ? listing.attributes
    : {};

  if (Object.keys(legacy).length > 0) {
    await Listing.updateOne(
      { id: listing.id },
      {
        $set: { attributes: { ...legacy, ...canonical } },
        $unset: { additionalAttributes: "" }
      }
    );
    attributesUpdated += 1;
  }

  if (!String(listing.contactPhone || "").trim() && listing.providerId) {
    const provider = await Provider.findOne({ id: Number(listing.providerId) });
    if (provider?.phone) {
      await Listing.updateOne(
        { id: listing.id },
        { $set: { contactPhone: String(provider.phone).trim() } }
      );
      phonesFilled += 1;
    }
  }
}

console.log(`Canonicalized ${attributesUpdated} listings and filled ${phonesFilled} missing phone fields.`);
process.exit(0);
