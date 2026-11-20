import { createHash, randomBytes } from "crypto";
import Favorite from "../models/Favorite.js";
import FavoritePreference from "../models/FavoritePreference.js";
import FavoriteDigestDelivery from "../models/FavoriteDigestDelivery.js";
import FavoriteUnsubscribeToken from "../models/FavoriteUnsubscribeToken.js";
import { favoriteDateEndAt, nextFavoriteDigestAt } from "../utils/favoriteSchedule.js";

const SNAPSHOT_FIELDS = [
  "title",
  "name",
  "category",
  "imageUrl",
  "price",
  "originalPrice",
  "currency",
  "location",
];
const SNAPSHOT_MAX_LENGTH = {
  title: 240,
  name: 160,
  category: 120,
  imageUrl: 2048,
  currency: 8,
  location: 180,
};

const normalizeFavorite = (input) => {
  if (!input || typeof input !== "object") {
    throw new TypeError("Each favorite must be an object");
  }
  const source = input.source;
  const verticalId = String(input.verticalId || "").trim();
  const itemId = String(input.itemId ?? "").trim();
  if (!["listing", "offer"].includes(source)) {
    throw new TypeError("Favorite source must be listing or offer");
  }
  if (!verticalId || verticalId.length > 80) {
    throw new TypeError("Favorite verticalId is required and must be at most 80 characters");
  }
  if (!itemId || itemId.length > 100) {
    throw new TypeError("Favorite itemId is required and must be at most 100 characters");
  }
  const snapshot = {};
  const supplied = input.snapshot && typeof input.snapshot === "object" ? input.snapshot : {};
  for (const field of SNAPSHOT_FIELDS) {
    const value = supplied[field];
    if (value === undefined || value === null || value === "") continue;
    if (["price", "originalPrice"].includes(field)) {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) continue;
      snapshot[field] = number;
    } else {
      snapshot[field] = String(value).trim().slice(0, SNAPSHOT_MAX_LENGTH[field]);
    }
  }
  return { source, verticalId, itemId, snapshot };
};

export const listFavorites = (userId) =>
  Favorite.find({ userId }).sort({ updatedAt: -1 }).lean();

export const upsertFavorite = async (userId, input) => {
  const favorite = normalizeFavorite(input);
  const initialPrice = favorite.snapshot.price;
  return Favorite.findOneAndUpdate(
    { userId, source: favorite.source, verticalId: favorite.verticalId, itemId: favorite.itemId },
    {
      $set: { snapshot: favorite.snapshot },
      $setOnInsert: {
        lastNotified: {
          price: initialPrice,
          currency: favorite.snapshot.currency || "QAR",
          available: true,
          checkedAt: new Date(),
        },
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
};

export const mergeFavorites = async (userId, inputs) => {
  if (!Array.isArray(inputs) || inputs.length > 500) {
    throw new TypeError("favorites must be an array containing at most 500 entries");
  }
  const normalized = inputs.map(normalizeFavorite);
  if (normalized.length) {
    await Favorite.bulkWrite(
      normalized.map((favorite) => ({
        updateOne: {
          filter: {
            userId,
            source: favorite.source,
            verticalId: favorite.verticalId,
            itemId: favorite.itemId,
          },
          update: {
            $set: { snapshot: favorite.snapshot },
            $setOnInsert: {
              lastNotified: {
                price: favorite.snapshot.price,
                currency: favorite.snapshot.currency || "QAR",
                available: true,
                checkedAt: new Date(),
              },
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  }
  return listFavorites(userId);
};

export const deleteFavorite = ({ userId, source, verticalId, itemId }) =>
  Favorite.deleteOne({ userId, source, verticalId, itemId });

export const getPreferences = (userId) =>
  FavoritePreference.findOne({ userId }).lean();

export const savePreferences = async (userId, input, accountEmail, accountEmailVerified = false) => {
  const current = await FavoritePreference.findOne({ userId });
  const enabled = input.enabled === true;
  const cadence = input.cadence || "weekly";
  if (!["daily", "weekly", "monthly", "once"].includes(cadence)) {
    throw new TypeError("cadence must be daily, weekly, monthly, or once");
  }
  const email = String(input.email || accountEmail || "").trim().toLowerCase();
  if (enabled && !email) throw new TypeError("A notification email is required");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TypeError("A valid notification email is required");
  }
  const categories = input.categories;
  if (!Array.isArray(categories) || categories.length > 30 ||
      categories.some((category) => typeof category !== "string" || category.length > 80)) {
    throw new TypeError("categories must be an array of at most 30 category identifiers");
  }
  const oneTimeDate = cadence === "once" && input.oneTimeDate ? String(input.oneTimeDate).slice(0, 10) : undefined;
  if (cadence === "once" && (!oneTimeDate || !/^\d{4}-\d{2}-\d{2}$/.test(oneTimeDate))) {
    throw new TypeError("oneTimeDate must be a future date for a one-time notification");
  }
  const timezone = String(input.timezone || "Asia/Qatar");
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    throw new TypeError("timezone must be a valid IANA timezone");
  }
  const endDateValue = input.endDate ? String(input.endDate).slice(0, 10) : undefined;
  if (endDateValue && !/^\d{4}-\d{2}-\d{2}$/.test(endDateValue)) {
    throw new TypeError("endDate must use YYYY-MM-DD format");
  }
  if (oneTimeDate) favoriteDateEndAt(oneTimeDate, timezone);
  const endDate = endDateValue ? favoriteDateEndAt(endDateValue, timezone) : undefined;

  const changedAddress = current?.email !== email;
  const isAccountEmail = Boolean(accountEmailVerified && accountEmail && email === accountEmail.trim().toLowerCase());
  const schedule = { cadence, oneTimeDate, timezone };
  const nextDueAt = enabled ? nextFavoriteDigestAt(schedule, new Date()) : null;
  if (cadence === "once" && !nextDueAt) throw new TypeError("oneTimeDate must be a future date");
  const setFields = {
    enabled,
    email,
    emailVerified: isAccountEmail || (!changedAddress && current?.emailVerified === true),
    optedInAt: enabled ? (!current?.enabled ? new Date() : current.optedInAt || new Date()) : current?.optedInAt,
    cadence,
    categories: [...new Set(categories.map((category) => category.trim()).filter(Boolean))],
    timezone,
  };
  if (oneTimeDate) setFields.oneTimeDate = new Date(`${oneTimeDate}T00:00:00.000Z`);
  if (endDate) setFields.endDate = endDate;
  if (enabled && nextDueAt) setFields.nextDueAt = nextDueAt;

  const unsetFields = {};
  if (!oneTimeDate) unsetFields.oneTimeDate = 1;
  if (!endDate) unsetFields.endDate = 1;
  if (!enabled) unsetFields.nextDueAt = 1;

  const preference = await FavoritePreference.findOneAndUpdate(
    { userId },
    { $set: setFields, $unset: unsetFields },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  if (!enabled || changedAddress) {
    await FavoriteUnsubscribeToken.deleteMany({ userId });
  }
  return preference.toObject();
};

export const issueUnsubscribeToken = async (userId) => {
  const token = randomBytes(32).toString("base64url");
  await FavoriteUnsubscribeToken.create({
    userId,
    tokenHash: createHash("sha256").update(token).digest("hex"),
  });
  return token;
};

export const unsubscribeByToken = async (token) => {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const unsubscribeRecord = await FavoriteUnsubscribeToken.findOne({ tokenHash }).select("+tokenHash").lean();
  if (!unsubscribeRecord) return null;
  const preference = await FavoritePreference.findOneAndUpdate(
    { userId: unsubscribeRecord.userId },
    { $set: { enabled: false }, $unset: { nextDueAt: 1 } },
    { new: true }
  ).lean();
  await FavoriteUnsubscribeToken.deleteMany({ userId: unsubscribeRecord.userId });
  return preference;
};

export const verifyPreferenceEmail = async (token) => {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return FavoritePreference.findOneAndUpdate(
    {
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: { $gt: new Date() },
    },
    {
      $set: { emailVerified: true },
      $unset: { emailVerificationTokenHash: 1, emailVerificationExpiresAt: 1 },
    },
    { new: true }
  ).select("-unsubscribeTokenHash -emailVerificationTokenHash -emailVerificationExpiresAt").lean();
};

export const createPreferenceEmailVerificationToken = async (userId) => {
  const token = randomBytes(32).toString("base64url");
  await FavoritePreference.updateOne(
    { userId },
    {
      $set: {
        emailVerificationTokenHash: createHash("sha256").update(token).digest("hex"),
        emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    }
  );
  return token;
};

export { Favorite, FavoritePreference, FavoriteDigestDelivery, FavoriteUnsubscribeToken };
