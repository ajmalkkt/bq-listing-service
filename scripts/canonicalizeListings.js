import dotenv from "dotenv";
import Listing from "../models/Listing.js";
import Provider from "../models/Provider.js";
import { connectDB } from "../config/db.js";

dotenv.config();

await connectDB();

const listings = await Listing.find({});
let attributesUpdated = 0;
let phonesFilled = 0;
let accommodationsNormalized = 0;

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

  if (listing.verticalId === "accommodations") {
    const propertyTypes = ["Apartment", "Villa", "Standalone Villa", "Compound Villa", "Studio", "Penthouse", "Duplex", "Hotel Apartment", "Villa Apartment", "Townhouse", "Office", "Warehouse", "Shop", "Land & Plots", "Shared / Partition"];
    const existingAttributes = {
      ...(listing.additionalAttributes || {}),
      ...(listing.attributes || {})
    };
    let normalizedSubcategory = existingAttributes.propertyType;
    if (!propertyTypes.includes(normalizedSubcategory)) normalizedSubcategory = listing.subcategory;
    if (!propertyTypes.includes(normalizedSubcategory)) {
      if (listing.subcategory === "Commercial") normalizedSubcategory = "Office";
      else if (listing.subcategory === "Land & Plots") normalizedSubcategory = "Land & Plots";
      else if (listing.subcategory === "Shared/Partition") normalizedSubcategory = "Shared / Partition";
      else normalizedSubcategory = "Apartment";
    }
    const attributeUpdate = {
      ...(listing.additionalAttributes || {}),
      ...(listing.attributes || {})
    };
    delete attributeUpdate.sector;
    delete attributeUpdate.propertyType;

    await Listing.updateOne(
      { id: listing.id },
      {
        $set: {
          subcategory: normalizedSubcategory,
          attributes: attributeUpdate
        },
        $unset: {
          additionalAttributes: ""
        }
      }
    );
    accommodationsNormalized += 1;
  }

  if (listing.verticalId === "services") {
    const serviceTypes = ["Home Maintenance", "Education", "Business Services", "Tech & IT", "Automotive", "Cleaning", "Events", "Moving & Delivery", "Fashion & Tailoring", "Domestic Help", "Travel", "AC Repair", "Construction", "Health & Wellness", "Pest Control", "Beauty & Spa", "Pet Services", "Furniture & Decor", "Catering & Venues", "Facility Management"];
    const currentAttributes = {
      ...(listing.additionalAttributes || {}),
      ...(listing.attributes || {})
    };
    let normalizedSubcategory = currentAttributes.serviceCategory;
    if (!serviceTypes.includes(normalizedSubcategory)) normalizedSubcategory = listing.subcategory;

    const legacyMappings = {
      "Cleaning & Laundry": "Cleaning",
      "Moving & Transport": "Moving & Delivery",
      "IT & Digital": "Tech & IT",
      "Events & Catering": "Events",
      "Beauty & Fitness": "Beauty & Spa",
      "Legal & Business": "Business Services"
    };
    if (!serviceTypes.includes(normalizedSubcategory)) {
      normalizedSubcategory = legacyMappings[normalizedSubcategory] || "Home Maintenance";
    }

    delete currentAttributes.serviceCategory;
    await Listing.updateOne(
      { id: listing.id },
      {
        $set: {
          subcategory: normalizedSubcategory,
          attributes: { ...currentAttributes, serviceCategory: normalizedSubcategory }
        },
        $unset: { additionalAttributes: "" }
      }
    );
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

console.log(`Canonicalized ${attributesUpdated} listings, normalized ${accommodationsNormalized} accommodations, and filled ${phonesFilled} missing phone fields.`);
process.exit(0);
