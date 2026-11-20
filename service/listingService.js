import Listing from "../models/Listing.js";

const EMAIL_FIELDS = "id verticalId category title imageUrl pricing originalPrice discountedPrice location active validity status";

export const findNewFavoriteListings = async ({ verticalIds, createdAfter, now, limit }) => {
  if (!verticalIds.length) return [];
  return Listing.find({
    verticalId: { $in: verticalIds },
    active: true,
    "validity.to": { $gte: now },
    createdAt: { $gt: createdAfter },
  }).select(EMAIL_FIELDS).sort({ createdAt: -1 }).limit(limit).lean();
};

export const findFavoriteListingsByIds = async (favorites) => {
  const keys = favorites
    .map((favorite) => ({ id: Number(favorite.itemId), verticalId: favorite.verticalId }))
    .filter((key) => Number.isFinite(key.id));
  if (!keys.length) return [];
  return Listing.find({ $or: keys })
    .select(EMAIL_FIELDS)
    .lean();
};
