import {
  deleteFavorite,
  createPreferenceEmailVerificationToken,
  getPreferences,
  issueUnsubscribeToken,
  listFavorites,
  mergeFavorites,
  savePreferences,
  unsubscribeByToken,
  upsertFavorite,
  verifyPreferenceEmail,
} from "../service/favoriteService.js";
import { sendFavoriteEmailVerification } from "../utils/emailService.js";
import { runFavoriteDigestBatch } from "../service/favoriteDigestService.js";

const userIdFromRequest = (req) => req.user?.uid;

const handleError = (res, error, message) => {
  if (error instanceof TypeError) return res.status(400).json({ message: error.message });
  console.error(message, error);
  return res.status(500).json({ message });
};

export const getFavorites = async (req, res) => {
  try {
    const userId = userIdFromRequest(req);
    const [favorites, preferences] = await Promise.all([listFavorites(userId), getPreferences(userId)]);
    return res.status(200).json({ favorites, preferences });
  } catch (error) {
    return handleError(res, error, "Unable to load favorites");
  }
};

export const putFavorite = async (req, res) => {
  try {
    const favorite = await upsertFavorite(userIdFromRequest(req), {
      source: req.params.source,
      verticalId: req.params.verticalId,
      itemId: req.params.itemId,
      snapshot: req.body?.snapshot,
    });
    return res.status(200).json(favorite);
  } catch (error) {
    return handleError(res, error, "Unable to save favorite");
  }
};

export const removeFavorite = async (req, res) => {
  try {
    const result = await deleteFavorite({
      userId: userIdFromRequest(req),
      source: req.params.source,
      verticalId: req.params.verticalId,
      itemId: req.params.itemId,
    });
    return res.status(200).json({ deleted: result.deletedCount > 0 });
  } catch (error) {
    return handleError(res, error, "Unable to remove favorite");
  }
};

export const syncFavorites = async (req, res) => {
  try {
    const favorites = await mergeFavorites(userIdFromRequest(req), req.body?.favorites);
    return res.status(200).json({ favorites });
  } catch (error) {
    return handleError(res, error, "Unable to synchronize favorites");
  }
};

export const getFavoritePreferences = async (req, res) => {
  try {
    return res.status(200).json(await getPreferences(userIdFromRequest(req)));
  } catch (error) {
    return handleError(res, error, "Unable to load notification preferences");
  }
};

export const putFavoritePreferences = async (req, res) => {
  try {
    const preference = await savePreferences(
      userIdFromRequest(req),
      req.body || {},
      req.user?.email,
      req.user?.email_verified === true
    );
    if (preference.enabled && !preference.emailVerified) {
      const token = await createPreferenceEmailVerificationToken(userIdFromRequest(req));
      const verificationUrl = `${process.env.FRONTEND_URL || "https://browseqatar.com"}/favourites?verifyEmail=${encodeURIComponent(token)}`;
      await sendFavoriteEmailVerification({ email: preference.email, verificationUrl });
      return res.status(200).json({ ...preference, verificationRequired: true });
    }
    return res.status(200).json(preference);
  } catch (error) {
    return handleError(res, error, "Unable to save notification preferences");
  }
};

export const unsubscribe = async (req, res) => {
  try {
    const preference = await unsubscribeByToken(req.params.token);
    if (!preference) return res.status(404).json({ message: "Unsubscribe link is invalid or expired" });
    return res.status(200).json({ message: "Notifications have been turned off" });
  } catch (error) {
    return handleError(res, error, "Unable to unsubscribe");
  }
};

export const verifyFavoriteEmail = async (req, res) => {
  try {
    const preference = await verifyPreferenceEmail(req.params.token);
    if (!preference) return res.status(400).json({ message: "Email verification link is invalid or expired" });
    return res.status(200).json({ message: "Notification email verified" });
  } catch (error) {
    return handleError(res, error, "Unable to verify notification email");
  }
};

export const createUnsubscribeToken = async (req, res) => {
  try {
    const token = await issueUnsubscribeToken(userIdFromRequest(req));
    return res.status(200).json({ token });
  } catch (error) {
    return handleError(res, error, "Unable to create unsubscribe token");
  }
};

export const runFavoriteDigest = async (req, res) => {
  try {
    const result = await runFavoriteDigestBatch();
    return res.status(200).json(result);
  } catch (error) {
    console.error("Favorite digest batch failed:", error);
    return res.status(500).json({ message: "Unable to process favorites digests" });
  }
};
