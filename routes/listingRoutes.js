import express from "express";
import { 
  getAllListings, 
  getListingById, 
  createListing, 
  updateListing, 
  getVerticals 
} from "../controllers/listingController.js";
import { verifyAuthToken, verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllListings);
router.get("/verticals", getVerticals);
router.get("/:id", getListingById);

// Protected routes
router.post("/", verifyAuthToken, verifyAdmin, createListing);
router.put("/:id", verifyAuthToken, verifyAdmin, updateListing);

export default router;
