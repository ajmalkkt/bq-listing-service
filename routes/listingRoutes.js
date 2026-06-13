import express from "express";
import { 
  getAllListings, 
  getListingById, 
  createListing, 
  updateListing, 
  getVerticals 
} from "../controllers/listingController.js";
import { verifyAuthToken, verifyAdmin } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Public routes
router.get("/", getAllListings);
router.get("/verticals", getVerticals);
router.get("/:id", getListingById);

const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'galleryUrls', maxCount: 5 }
]);

// Protected routes
router.post("/", verifyAuthToken, verifyAdmin, uploadFields, createListing);
router.put("/:id", verifyAuthToken, verifyAdmin, uploadFields, updateListing);

export default router;
