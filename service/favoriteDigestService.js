import Favorite from "../models/Favorite.js";
import FavoritePreference from "../models/FavoritePreference.js";
import FavoriteDigestDelivery from "../models/FavoriteDigestDelivery.js";
import { issueUnsubscribeToken } from "./favoriteService.js";
import { findFavoriteListingsByIds, findNewFavoriteListings } from "./listingService.js";
import { findFavoriteOffersByIds, findNewFavoriteOffers } from "./offerService.js";
import { nextFavoriteDigestAt } from "../utils/favoriteSchedule.js";
import { sendFavoriteDigestEmail } from "../utils/emailService.js";

const MAX_DUE_USERS = 100;
const MAX_NEW_ITEMS_PER_USER = 80;
const CLAIM_LEASE_MS = 10 * 60 * 1000;

const priceOfListing = (listing) => listing.pricing?.discountedPrice ?? listing.discountedPrice ?? listing.pricing?.originalPrice ?? listing.originalPrice;
const priceOfOffer = (offer) => offer.discountedPrice ?? offer.originalPrice;
const availableListing = (listing, now) => Boolean(
  listing && listing.active !== false && listing.status !== "inactive" &&
  listing.validity?.to && new Date(listing.validity.to) >= now
);
const availableOffer = (offer, now) => Boolean(
  offer && offer.active !== false && offer.validTo && new Date(offer.validTo) >= now
);

const listSnapshot = (item) => ({
  title: item.title || "Browse Qatar listing",
  category: item.category || item.verticalId || "Listings",
  imageUrl: item.imageUrl || "",
  price: priceOfListing(item),
  currency: item.pricing?.currency || "QAR",
  location: item.location?.city || item.location?.address || "",
});

const offerSnapshot = (item) => ({
  title: item.title || "Restaurant offer",
  name: item.restaurantName || item.title || "Restaurant offer",
  category: item.category || "Restaurants",
  imageUrl: item.imageUrl || "",
  price: priceOfOffer(item),
  currency: "QAR",
  location: item.location || "",
});

const publicUrl = (path) => `${(process.env.FRONTEND_URL || "https://browseqatar.com").replace(/\/$/, "")}${path}`;
const currentState = (item, available, price, currency) => ({
  available,
  price: Number.isFinite(Number(price)) ? Number(price) : undefined,
  currency: currency || "QAR",
  checkedAt: new Date(),
});

const changedState = (previous, current) => {
  if (!previous) return false;
  return previous.available !== current.available ||
    (current.available && previous.price !== undefined && current.price !== undefined && Number(previous.price) !== Number(current.price));
};

const classifyChange = (previous, current) => {
  if (previous.available !== current.available) return "availability";
  return "price";
};

const claimWindow = async (userId, windowKey, now) => {
  const filter = {
    userId,
    windowKey,
    $or: [
      { status: "failed" },
      { status: "processing", leaseUntil: { $lte: now } },
    ],
  };
  const claimed = await FavoriteDigestDelivery.findOneAndUpdate(
    filter,
    { $set: { status: "processing", leaseUntil: new Date(now.getTime() + CLAIM_LEASE_MS), error: "" }, $inc: { attempts: 1 } },
    { new: true }
  );
  if (claimed) return claimed;
  try {
    return await FavoriteDigestDelivery.create({
      userId,
      windowKey,
      status: "processing",
      leaseUntil: new Date(now.getTime() + CLAIM_LEASE_MS),
      attempts: 1,
    });
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
};

const findNewItems = async (preference, favorites, now) => {
  const categories = preference.categories || [];
  const baseline = preference.lastDigestAt || preference.createdAt || new Date(0);
  const [listings, offers] = await Promise.all([
    findNewFavoriteListings({
      verticalIds: categories,
      createdAfter: baseline,
      now,
      limit: MAX_NEW_ITEMS_PER_USER,
    }),
    categories.includes("restaurants")
      ? findNewFavoriteOffers({ createdAfter: baseline, now, limit: MAX_NEW_ITEMS_PER_USER })
      : [],
  ]);
  const saved = new Set(favorites.map((favorite) => `${favorite.source}:${favorite.verticalId}:${favorite.itemId}`));
  const newListings = listings
    .filter((item) => !saved.has(`listing:${item.verticalId}:${String(item.id)}`))
    .map((item) => ({
      source: "listing",
      itemId: String(item.id),
      verticalId: item.verticalId,
      title: item.title || "Browse Qatar listing",
      category: item.category || item.verticalId,
      price: priceOfListing(item),
      currency: item.pricing?.currency || "QAR",
      location: item.location?.city || item.location?.address || "",
      url: publicUrl(`/marketplace/${encodeURIComponent(item.verticalId)}/${encodeURIComponent(item.id)}`),
    }));
  const newOffers = offers
    .filter((item) => !saved.has(`offer:restaurants:${String(item.id)}`))
    .map((item) => ({
      source: "offer",
      itemId: String(item.id),
      verticalId: "restaurants",
      title: item.title || item.restaurantName || "Restaurant offer",
      category: item.category || "Restaurants",
      price: priceOfOffer(item),
      currency: "QAR",
      location: item.location || "",
      url: publicUrl(`/offer/${encodeURIComponent(item.id)}`),
    }));
  return [...newListings, ...newOffers].slice(0, MAX_NEW_ITEMS_PER_USER);
};

const findFavoriteChanges = async (favorites, now) => {
  const changes = [];
  const updates = [];
  const listingFavorites = favorites.filter((favorite) => favorite.source === "listing");
  const offerFavorites = favorites.filter((favorite) => favorite.source === "offer");
  const [listings, offers] = await Promise.all([
    findFavoriteListingsByIds(listingFavorites),
    findFavoriteOffersByIds(offerFavorites.map((favorite) => favorite.itemId)),
  ]);
  const listingsByKey = new Map(listings.map((item) => [`${item.verticalId}:${item.id}`, item]));
  const offersById = new Map(offers.map((item) => [String(item.id), item]));

  for (const favorite of favorites) {
    const item = favorite.source === "offer"
      ? offersById.get(favorite.itemId)
      : listingsByKey.get(`${favorite.verticalId}:${Number(favorite.itemId)}`);

    const available = favorite.source === "offer"
      ? availableOffer(item, now)
      : availableListing(item, now);
    const snapshot = item
      ? (favorite.source === "offer" ? offerSnapshot(item) : listSnapshot(item))
      : favorite.snapshot || {};
    const price = item ? (favorite.source === "offer" ? priceOfOffer(item) : priceOfListing(item)) : undefined;
    const current = currentState(item, available, price, snapshot.currency);
    if (changedState(favorite.lastNotified, current)) {
      const previous = favorite.lastNotified;
      changes.push({
        title: snapshot.title || snapshot.name || favorite.itemId,
        category: snapshot.category || favorite.verticalId,
        location: snapshot.location || "",
        currency: current.currency,
        previousPrice: previous.price,
        price: current.price,
        available: current.available,
        change: classifyChange(previous, current),
        url: favorite.source === "offer"
          ? publicUrl(`/offer/${encodeURIComponent(favorite.itemId)}`)
          : publicUrl(`/marketplace/${encodeURIComponent(favorite.verticalId)}/${encodeURIComponent(favorite.itemId)}`),
      });
      updates.push({ favoriteId: favorite._id, current });
    }
  }
  return { changes, updates };
};

const completePreferenceWindow = async (preference, now) => {
  const nextDueAt = nextFavoriteDigestAt(preference, now);
  const shouldDisable = preference.cadence === "once" || (preference.endDate && new Date(preference.endDate) < now);
  await FavoritePreference.updateOne(
    { _id: preference._id },
    {
      $set: {
        enabled: shouldDisable ? false : preference.enabled,
        lastDigestAt: now,
        nextDueAt: shouldDisable ? null : nextDueAt,
      },
    }
  );
};

export const runFavoriteDigestBatch = async ({ now = new Date(), limit = MAX_DUE_USERS } = {}) => {
  const due = await FavoritePreference.find({
    enabled: true,
    emailVerified: true,
    email: { $type: "string", $ne: "" },
    nextDueAt: { $lte: now },
    $or: [{ endDate: null }, { endDate: { $gte: now } }],
  }).sort({ nextDueAt: 1 }).limit(Math.min(Math.max(Number(limit) || MAX_DUE_USERS, 1), MAX_DUE_USERS)).lean();

  const summary = { considered: due.length, sent: 0, skipped: 0, failed: 0 };
  for (const preference of due) {
    const windowKey = `${preference.cadence}:${new Date(preference.nextDueAt).toISOString()}`;
    const claim = await claimWindow(preference.userId, windowKey, now);
    if (!claim) {
      summary.skipped += 1;
      continue;
    }

    let emailAccepted = false;
    try {
      const favorites = await Favorite.find({ userId: preference.userId }).lean();
      const [newItems, { changes, updates }] = await Promise.all([
        findNewItems(preference, favorites, now),
        findFavoriteChanges(favorites, now),
      ]);
      if (newItems.length || changes.length) {
        if (!process.env.PUBLIC_API_URL) {
          throw new Error("PUBLIC_API_URL must be configured before sending favorites digests");
        }
        const unsubscribeToken = await issueUnsubscribeToken(preference.userId);
        const unsubscribeUrl = `${process.env.PUBLIC_API_URL.replace(/\/$/, "")}/api/favorites/unsubscribe/${encodeURIComponent(unsubscribeToken)}`;
        await sendFavoriteDigestEmail({
          email: preference.email,
          newItems,
          changes,
          unsubscribeUrl,
        });
        emailAccepted = true;
        await FavoriteDigestDelivery.updateOne(
          { _id: claim._id },
          { $set: { status: "sent", sentAt: now, leaseUntil: null } }
        );
        summary.sent += 1;
        if (updates.length) {
          await Favorite.bulkWrite(updates.map(({ favoriteId, current }) => ({
            updateOne: { filter: { _id: favoriteId }, update: { $set: { lastNotified: current } } },
          })));
        }
      } else {
        summary.skipped += 1;
      }

      await completePreferenceWindow(preference, now);
      if (!emailAccepted) {
        await FavoriteDigestDelivery.updateOne(
          { _id: claim._id },
          { $set: { status: "sent", leaseUntil: null } }
        );
      }
    } catch (error) {
      if (emailAccepted) {
        console.error(`Favorite digest was accepted but final state update failed for user ${preference.userId}:`, error);
        try {
          await completePreferenceWindow(preference, now);
        } catch (stateError) {
          console.error(`Unable to advance accepted digest window for user ${preference.userId}:`, stateError);
        }
        continue;
      }
      summary.failed += 1;
      console.error(`Favorite digest failed for user ${preference.userId}:`, error);
      await FavoriteDigestDelivery.updateOne(
        { _id: claim._id },
        { $set: { status: "failed", error: String(error?.message || error).slice(0, 500), leaseUntil: null } }
      );
    }
  }
  return summary;
};
