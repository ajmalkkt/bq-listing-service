import express from "express";
import upload from "../middleware/upload.js";
import { verifyApiToken, verifyAdmin, requireRole, verifyAuthToken } from "../middleware/authMiddleware.js";
import {
  addOrUpdateOffer,
  updateOffer,
  syncRestaurantNames,
  getAllOffers,
  getOfferById,
  getOffersByRestaurant,
  getOffersByCuisineOrCategory,
  getOfferImage,
  deleteOffer,
  activateOffer,
  bulkActivateOffers,
  inActivateOffers,
  getInactiveOffers,
  getExpiredOffers,
  deleteAllOffers,
  deleteOfferImagesByRestaurant,
  getActiveOffers
} from "../controllers/offerController.js";

const router = express.Router();

router.post("/", verifyApiToken, requireRole('restaurant_owner'), upload.single("image"), addOrUpdateOffer);
router.put("/:id", verifyApiToken, requireRole('restaurant_owner'), upload.single("image"), updateOffer);
router.get("/", getAllOffers);
router.get("/:id", getOfferById);
router.get("/:restaurantId/restaurant", getOffersByRestaurant);
router.get("/search/:cuisine", getOffersByCuisineOrCategory);
router.get("/:id/image", getOfferImage);
router.delete("/:id", verifyAuthToken, requireRole('restaurant_owner'), deleteOffer);
router.patch("/activate/:id", verifyApiToken, verifyAdmin, activateOffer);
router.patch("/inactivate", verifyApiToken, verifyAdmin, inActivateOffers);
router.patch("/bulk-activate", verifyApiToken, verifyAdmin, bulkActivateOffers);
router.get("/all/inactive", getInactiveOffers);
router.get("/all/active", getActiveOffers);
router.get("/all/expired", getExpiredOffers);
//sync restaurant name to offers
router.patch("/sync-names/:status", verifyApiToken, verifyAdmin, syncRestaurantNames);
router.delete("/delete/all", verifyApiToken, verifyAdmin, deleteAllOffers);
router.delete("/delete/images/:restaurantId/:offerId", verifyApiToken, requireRole('restaurant_owner'), deleteOfferImagesByRestaurant);

export default router;
