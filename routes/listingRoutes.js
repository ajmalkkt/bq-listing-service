import express from "express";
import { 
  getAllListings, 
  getListingById, 
  createListing, 
  updateListing, 
  getVerticals,
  getInactiveListings,
  getActiveListings,
  activateListing,
  bulkActivateListings,
  inActivateListings,
  deleteListing
} from "../controllers/listingController.js";
import { verifyAuthToken, verifyAdmin, requireRole } from "../middleware/authMiddleware.js";
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
router.post("/", verifyAuthToken, requireRole('restaurant_owner'), uploadFields, createListing);
router.put("/:id", verifyAuthToken, requireRole('restaurant_owner'), uploadFields, updateListing);
router.get("/all/inactive", getInactiveListings);
router.get("/all/active", getActiveListings);
router.patch("/activate/:id", verifyAuthToken, verifyAdmin, activateListing);
router.patch("/inactivate", verifyAuthToken, verifyAdmin, inActivateListings);
router.patch("/bulk-activate", verifyAuthToken, verifyAdmin, bulkActivateListings);
router.delete("/:id", verifyAuthToken, requireRole('restaurant_owner'), deleteListing);

export default router;
