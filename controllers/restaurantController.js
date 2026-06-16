import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import Restaurant from "../models/Restaurant.js";
import { getNextSequence, setSequenceValue } from "../utils/sequenceGenerator.js";
import {
  uploadRestaurantImageToGCS, deleteAllRestaurantImages,
  deleteAllOffersForRestaurant, deleteAllImagesFromGCS,
  uploadRestaurantMenuImageToGCS, deleteRestaurantMenuImage
} from '../service/storageService.js';
import { log } from "console";
import { getCache, setCache } from "../utils/cacheHelper.js";
import { writeExcelFileWithExcelJS } from "../middleware/excelManager.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const addOrUpdateRestaurant = async (req, res) => {
  try {
    //log("Add/Update Restaurant :", req.body);
    const { id, name, address, phone, rating, cuisine, logoUrl, brandUrl, country } = req.body;
    const saveToDB = process.env.SAVE_IMAGES_TO_DB === "true";
    const restaurantId = id || (await getNextSequence("restaurants"));

    const updateData = {
      id: restaurantId,
      name,
      address,
      phone,
      rating,
      cuisine,
      logoUrl,
      brandUrl,
      country,
      ownerLogin: req.user.email, // Set ownerLogin from authenticated user's email 
    };

    // ✅ Handle logo upload
    if (req.files?.logo?.[0]) {
      const logoFile = req.files.logo[0];
      if (saveToDB) {
        //updateData.logoImage = logoFile.buffer;
        //updateData.logoImageType = logoFile.mimetype;

        try {
          //const ext = logoFile.mimetype.split('/')[1] || 'jpg';
          const gcsUrl = await uploadRestaurantImageToGCS(
            logoFile, "logo", logoFile.mimetype, restaurantId, name);
          updateData.logoUrl = gcsUrl;
          log(`Logo image uploaded to GCS: ${gcsUrl}`);
          updateData.logoImage = null;
          updateData.logoImageType = null;
        } catch (uploadErr) {
          console.error("Error uploading logo to GCS:", uploadErr);
          //Fallback to DB storage
          updateData.logoImage = logoFile.buffer;
          updateData.logoImageType = logoFile.mimetype;
          //return res.status(500).json({ error: "Error uploading logo image" });
        }

      } else {
        const folderPath = path.join(__dirname, "../uploads/restaurants");
        if (!fs.existsSync(folderPath))
          fs.mkdirSync(folderPath, { recursive: true });
        fs.writeFileSync(
          path.join(folderPath, `logo-${restaurantId}.jpg`),
          logoFile.buffer
        );
      }
    }

    // ✅ Handle brand upload
    if (req.files?.brand?.[0]) {
      // Set imageUrl
      const protocol = process.env.PROTOCOL || req.protocol;
      const baseUrl = `${protocol}://${req.get("host")}`;
      const logoPath = `${baseUrl}/api/restaurants/${restaurantId}/image/logo`;
      const brandPath = `${baseUrl}/api/restaurants/${restaurantId}/image/brand`;

      const brandFile = req.files.brand[0];
      if (saveToDB) {
        //updateData.brandImage = brandFile.buffer;
        //updateData.brandImageType = brandFile.mimetype;
        //updateData.logoUrl = logoPath;
        //updateData.brandUrl = brandPath; 
        try {
          //const ext = brandFile.mimetype.split('/')[1] || 'jpg';
          const gcsUrl = await uploadRestaurantImageToGCS(
            brandFile, "brand", brandFile.mimetype, restaurantId, name);
          updateData.brandUrl = gcsUrl;
          log(`Brand image uploaded to GCS: ${gcsUrl}`);
          updateData.brandImage = null;
          updateData.brandImageType = null;
        } catch (uploadErr) {
          console.error("Error uploading Brand to GCS:", uploadErr);
          //Fallback to DB storage
          updateData.brandImage = brandFile.buffer;
          updateData.brandImageType = brandFile.mimetype;
          //return res.status(500).json({ error: "Error uploading Brand image" });
        }
      } else {
        const folderPath = path.join(__dirname, "../uploads/restaurants");
        if (!fs.existsSync(folderPath))
          fs.mkdirSync(folderPath, { recursive: true });
        fs.writeFileSync(
          path.join(folderPath, `restaurant-${restaurantId}.jpg`),
          brandFile.buffer
        );
      }
    }

    const restaurant = await Restaurant.findOneAndUpdate(
      { id: restaurantId },
      updateData,
      { upsert: true, new: true }
    );

    res.json({ success: true, restaurant });
  } catch (err) {
    console.error("Error saving restaurant:", err);
    res.status(500).json({ error: err.message });
  }
};

//activateAllRestaurants. 
//Sample payload: {"restaurantIds": ["1", "2", "3"]}
//Sample request: POST /api/restaurants/activate/all
export const activateAllRestaurants = async (req, res) => {
  try {
    const { status } = req.params;
    const { restaurantIds } = req.body;
    //add filter if id are provided.
    let filter = {};
    if (restaurantIds && restaurantIds.length > 0) {
      log("Restaurant IDs provided. Activating/Deactivating specific restaurants.");
      filter = { id: { $in: restaurantIds } };
    } else {
      log("No restaurant IDs provided. Activating/Deactivating all restaurants.");
    }
    const updateData = { active: status === "activate" };
    const restaurants = await Restaurant.updateMany(
      filter,
      updateData
    );
    res.json({ success: true, restaurants });
  } catch (err) {
    console.error("Error activating/inactivating restaurants:", err);
    res.status(500).json({ error: err.message });
  }
};
// Get all restaurants
export const getAllRestaurants = async (req, res) => {
  try {
    // projection to exclude image buffers
    //cache the result 
    const cacheKey = "allRestaurants";
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      console.log("Restaurants fetched from cache Key:", cacheKey);
      res.status(200).json(cachedData);
      return;
    }
    //get active=true restaurants
    const restaurants = await Restaurant.find({ active: true }, "-logoImage -logoImageType -brandImage -brandImageType -ownerLogin -__v -_id");
    const protocol = process.env.PROTOCOL || req.protocol;
    const baseUrl = `${protocol}://${req.get('host')}`;

    const data = restaurants.map(r => ({
      ...r.toObject(),
      logoUrl: r.logoImageType ? `${baseUrl}/api/restaurants/${r.id}/image/logo` : r.logoUrl,
      brandUrl: r.brandImageType ? `${baseUrl}/api/restaurants/${r.id}/image/brand` : r.brandUrl
    }));
    //setCache
    if (data.length > 0) {
      setCache(cacheKey, data); // Defaul Cache for 3 hours
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching restaurants', error: err.message });
  }
};

// Fetch all active restaurants . REsponse does not include image fields
// GET /api/restaurants/all/active  return restaurant id and name
export const getActiveRestaurants = async (req, res) => {
  try {
    const activeRestaurants = await Restaurant.find(
      {},
      "-logoImage -logoImageType -brandImage -brandImageType" // select only specific fields
    );
    log(`Fetched ${activeRestaurants.length} active restaurants.`);
    res.status(200).json(activeRestaurants);
  } catch (err) {
    console.error("Error fetching active restaurants:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getRestaurantById = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findOne({ id }, "-logoImage -logoImageType -brandImage -brandImageType");
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Set imageUrl
    const protocol = process.env.PROTOCOL || req.protocol;
    const baseUrl = `${protocol}://${req.get("host")}`;
    const data = {
      ...restaurant.toObject(),
      logoUrl: restaurant.logoImageType ? `${baseUrl}/api/restaurants/${restaurant.id}/image/logo` : restaurant.logoUrl,
      brandUrl: restaurant.brandImageType ? `${baseUrl}/api/restaurants/${restaurant.id}/image/brand` : restaurant.brandUrl
    };

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching restaurant', error: err.message });
  }
};

// Serve restaurant images (logo or brand)
export const getRestaurantImage = async (req, res) => {
  const { id, type } = req.params;

  try {
    const restaurant = await Restaurant.findOne({ id });
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const saveToDB = process.env.SAVE_IMAGES_TO_DB === "true";
    const imageField = type === "logo" ? "logoImage" : "brandImage";
    const imageTypeField = type === "logo" ? "logoImageType" : "brandImageType";

    if (saveToDB) {
      const imageData = restaurant[imageField];

      // ✅ Handle both Buffer and BSON Binary types
      if (imageData) {
        const buffer =
          imageData instanceof Buffer
            ? imageData
            : imageData.buffer
              ? Buffer.from(imageData.buffer)
              : Buffer.from(imageData);

        if (!buffer || buffer.length === 0) {
          return res.status(404).json({ message: `${type} image data is empty` });
        }

        const mimeType = restaurant[imageTypeField] || "image/jpeg";
        res.setHeader("Content-Type", mimeType);
        return res.end(buffer); // ✅ safer for binary data
      } else {
        return res
          .status(404)
          .json({ message: `${type} image not found in database` });
      }
    } else {
      // ✅ Mode: File system
      const folderPath = path.join(__dirname, "../uploads/restaurants");
      const fileName = type === "logo" ? `logo-${id}.jpg` : `restaurant-${id}.jpg`;
      const filePath = path.join(folderPath, fileName);

      if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
      } else {
        return res
          .status(404)
          .json({ message: `${type} image not found in file system` });
      }
    }
  } catch (err) {
    console.error("Error fetching image:", err);
    res.status(500).json({ message: "Error fetching image", error: err.message });
  }
};

export const deleteRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    // Verify ownership
    const restaurantToDelete = await Restaurant.findOne({ id });
    if (!restaurantToDelete) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    // Check if the requester is the owner or an admin
    // Allow deletion when requester is the owner OR has the 'admin' role.
    // If requester is NOT the owner AND is NOT an admin => forbid.
    if (restaurantToDelete.ownerLogin !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Forbidden: You do not own this restaurant" });
    }
    const restaurant = await Restaurant.findOneAndDelete({ id });
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

    // Optionally, delete associated images from file system
    const saveToDB = process.env.SAVE_IMAGES_TO_DB === "true";
    if (!saveToDB) {
      const folderPath = path.join(__dirname, "../uploads/restaurants");
      const logoPath = path.join(folderPath, `logo-${id}.jpg`);
      const brandPath = path.join(folderPath, `restaurant-${id}.jpg`);

      if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);
      if (fs.existsSync(brandPath)) fs.unlinkSync(brandPath);
    } else {
      // If images are stored in GCS, consider deleting them from there as well
      await deleteAllRestaurantImages(restaurant.id, restaurant.name);
      // also delete all offers for this restaurant
      await deleteAllOffersForRestaurant(restaurant.id);
    }

    res.json({ success: true, message: "Restaurant deleted successfully" });
  } catch (err) {
    console.error("Error deleting restaurant:", err);
    res.status(500).json({ error: err.message });
  }
};

//delete all restaurants - for testing purposes 
export const deleteAllRestaurants = async (req, res) => {
  try {
    const result = await Restaurant.deleteMany({});
    log(`Deleted ${result.deletedCount} restaurants.`);
    res.json({ success: true, message: `Deleted ${result.deletedCount} restaurants.` });
    //set sequence back to 0
    await setSequenceValue("restaurants", 0);
  } catch (err) {
    console.error("Error deleting all restaurants:", err);
    res.status(500).json({ error: err.message });
  }
};

// find all restaurants from mongo and delete all 
// restaurant and corresponding offer images from gcs 
export const deleteAllRestaurantsImages = async (req, res) => {
  try {
    //find all restaurants from mongo
    const restaurants = await Restaurant.find({});
    if (!restaurants || restaurants.length === 0) {
      return res.status(404).json({ message: "No restaurants found" });
    }
    //iterate through each restaurant and delete images from gcs

    let deletedCount = 0;
    for (const restaurant of restaurants) {
      await deleteAllRestaurantImages(restaurant.id, restaurant.name);
      // also delete all offers for this restaurant
      await deleteAllOffersForRestaurant(restaurant.id);
      deletedCount++;
    }

    res.json({ success: true, message: `Deleted ${deletedCount} restaurant and corresponding offer images from GCS.` });
  } catch (err) {
    console.error("Error deleting all restaurant images from GCS:", err);
    res.status(500).json({ error: err.message });
  }
};

// delete all images - offers/  and restaurants/ folders
export const deleteAllImages = async (req, res) => {
  try {
    await deleteAllImagesFromGCS();
    res.json({ success: true, message: `Deleted all images from GCS.` });
  } catch (err) {
    console.error("Error deleting all images from GCS:", err);
    res.status(500).json({ error: err.message });
  }
};


// Upload one or more menu page images for a restaurant
// POST /api/restaurants/:id/menu
export const uploadMenuImages = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findOne({ id });
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    // Check ownership
    if (restaurant.ownerLogin !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: You do not own this restaurant' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No menu image files provided' });
    }

    const startIndex = (restaurant.menuImages || []).length;
    const uploadedUrls = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const gcsUrl = await uploadRestaurantMenuImageToGCS(
        file, file.mimetype, restaurant.id, restaurant.name, startIndex + i
      );
      uploadedUrls.push(gcsUrl);
      log(`Menu page ${startIndex + i} uploaded for restaurant ${restaurant.name}: ${gcsUrl}`);
    }

    const updatedRestaurant = await Restaurant.findOneAndUpdate(
      { id },
      { $push: { menuImages: { $each: uploadedUrls } } },
      { new: true }
    );

    res.json({ success: true, menuImages: updatedRestaurant.menuImages });
  } catch (err) {
    console.error('Error uploading menu images:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete a specific menu page image from a restaurant
// DELETE /api/restaurants/:id/menu?url=...
export const deleteMenuImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { url } = req.query;

    if (!url) return res.status(400).json({ message: 'url query param required' });

    const restaurant = await Restaurant.findOne({ id });
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    if (restaurant.ownerLogin !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: You do not own this restaurant' });
    }

    // Delete from GCS
    try {
      await deleteRestaurantMenuImage(url);
    } catch (gcsErr) {
      console.warn('GCS delete failed (may not exist), continuing DB cleanup:', gcsErr.message);
    }

    // Remove from DB
    const updatedRestaurant = await Restaurant.findOneAndUpdate(
      { id },
      { $pull: { menuImages: url } },
      { new: true }
    );

    res.json({ success: true, menuImages: updatedRestaurant.menuImages });
  } catch (err) {
    console.error('Error deleting menu image:', err);
    res.status(500).json({ error: err.message });
  }
};

// Download all restaurants as Excel
export const downloadRestaurantsExcel = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({}).sort({ id: 1 });

    const columns = [
      { header: "id", key: "id", width: 10 },
      { header: "name", key: "name", width: 30 },
      { header: "address", key: "address", width: 40 },
      { header: "regEmail", key: "regEmail", width: 30 },
      { header: "phone", key: "phone", width: 20 },
      { header: "rating", key: "rating", width: 10 },
      { header: "rank", key: "rank", width: 10 },
      { header: "cuisine", key: "cuisine", width: 30 },
      { header: "logoUrl", key: "logoUrl", width: 50 },
      { header: "brandUrl", key: "brandUrl", width: 50 },
      { header: "country", key: "country", width: 15 },
      { header: "logoImagePath", key: "logoImagePath", width: 50 },
      { header: "brandImagePath", key: "brandImagePath", width: 50 },
    ];

    const data = restaurants.map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      regEmail: restaurant.ownerLogin,
      phone: restaurant.phone,
      rating: restaurant.rating,
      rank: restaurant.rank,
      cuisine: Array.isArray(restaurant.cuisine) ? restaurant.cuisine.join(", ") : restaurant.cuisine,
      logoUrl: restaurant.logoUrl,
      brandUrl: restaurant.brandUrl,
      country: restaurant.country,
      logoImagePath: "", // Placeholder
      brandImagePath: "", // Placeholder
    }));

    await writeExcelFileWithExcelJS(res, data, "Restaurants", columns, "restaurants.xlsx");
  } catch (err) {
    console.error("Error exporting restaurants to Excel:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};