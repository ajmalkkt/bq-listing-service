import Offer from "../models/Offer.js";

const EMAIL_FIELDS = "id title restaurantName category imageUrl discountedPrice originalPrice location validTo active";

export const findNewFavoriteOffers = async ({ createdAfter, now, limit }) =>
  Offer.find({
    active: true,
    validTo: { $gte: now },
    createdAt: { $gt: createdAfter },
  }).select(EMAIL_FIELDS).sort({ createdAt: -1 }).limit(limit).lean();

export const findFavoriteOffersByIds = async (itemIds) => {
  const ids = itemIds.map(Number).filter(Number.isFinite);
  if (!ids.length) return [];
  return Offer.find({ id: { $in: ids } }).select(EMAIL_FIELDS).lean();
};
