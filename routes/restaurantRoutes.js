import express from "express";
import upload from "../middleware/upload.js";
import { verifyApiToken, requireRole, verifyAdmin, verifyAuthToken } from "../middleware/authMiddleware.js";
import {
  addOrUpdateRestaurant,
  getAllRestaurants,
  getRestaurantImage,
  getRestaurantById,
  deleteRestaurant,
  deleteAllRestaurants,
  deleteAllRestaurantsImages,
  deleteAllImages,
  getActiveRestaurants,
  activateAllRestaurants,
  uploadMenuImages,
  deleteMenuImage
} from "../controllers/restaurantController.js";  // ✅ include .js extension in ESM

const router = express.Router();

// Create or update a restaurant
//router.post("/", upload.single("logo"), addOrUpdateRestaurant);
router.post("/", verifyApiToken, requireRole('restaurant_owner'), upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "brand", maxCount: 1 },
]), addOrUpdateRestaurant);
//router.post("/", addOrUpdateRestaurant);

// Get all restaurants
router.get("/", getAllRestaurants);
router.get("/all/active", getActiveRestaurants);

// Get a restaurant’s image (logo or brand)
router.get("/:id/image/:type", getRestaurantImage);
router.get("/:id", getRestaurantById);
router.delete("/:id", verifyAuthToken, requireRole('restaurant_owner'), deleteRestaurant);
router.delete("/delete/all", verifyApiToken, verifyAdmin, deleteAllRestaurants);
router.delete("/delete/images/all", verifyApiToken, verifyAdmin, deleteAllRestaurantsImages);
router.delete("/delete/images/folders", verifyApiToken, verifyAdmin, deleteAllImages);
//add endpoint to activate/inactivate all restaurants and also
//if the list of holtel ids is provided, activate/inactivate only those hotels
router.post("/:status/all", verifyApiToken, verifyAdmin, activateAllRestaurants);

// Menu image routes
router.post("/:id/menu", verifyAuthToken, requireRole('restaurant_owner'), upload.array('menu', 20), uploadMenuImages);
router.delete("/:id/menu", verifyAuthToken, requireRole('restaurant_owner'), deleteMenuImage);

export default router;
