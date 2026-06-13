import express from "express";
import {
  getAllProviders,
  getMyProviders,
  getProviderById,
  createProvider,
  updateProvider,
  deleteProvider,
} from "../controllers/providerController.js";
import { verifyAuthToken, verifyAdmin } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Upload config for logo + banner
const uploadFields = upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "banner", maxCount: 1 },
]);

// Public
router.get("/", getAllProviders);
router.get("/:id", getProviderById);

// Auth required - owner's own providers
router.get("/mine", verifyAuthToken, getMyProviders);

// Admin or owner protected
router.post("/", verifyAuthToken, uploadFields, createProvider);
router.put("/:id", verifyAuthToken, uploadFields, updateProvider);
router.delete("/:id", verifyAuthToken, verifyAdmin, deleteProvider);

export default router;
