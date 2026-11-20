import express from "express";
import { verifyAuthToken } from "../middleware/authMiddleware.js";
import { verifySchedulerIdentity } from "../middleware/verifySchedulerIdentity.js";
import {
  createUnsubscribeToken,
  getFavoritePreferences,
  getFavorites,
  putFavorite,
  putFavoritePreferences,
  removeFavorite,
  runFavoriteDigest,
  syncFavorites,
  unsubscribe,
  verifyFavoriteEmail,
} from "../controllers/favoriteController.js";

const router = express.Router();

router.get("/unsubscribe/:token", unsubscribe);
router.post("/unsubscribe/:token", unsubscribe);
router.get("/verify-email/:token", verifyFavoriteEmail);
router.post("/internal/digest", verifySchedulerIdentity, runFavoriteDigest);
router.use(verifyAuthToken);
router.get("/", getFavorites);
router.put("/sync", syncFavorites);
router.get("/preferences", getFavoritePreferences);
router.put("/preferences", putFavoritePreferences);
router.post("/unsubscribe-token", createUnsubscribeToken);
router.put("/:source/:verticalId/:itemId", putFavorite);
router.delete("/:source/:verticalId/:itemId", removeFavorite);

export default router;
