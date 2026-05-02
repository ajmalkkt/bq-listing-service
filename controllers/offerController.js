import e from "express";
import Offer from "../models/Offer.js";
import Restaurant from "../models/Restaurant.js";
import { getNextSequence, setSequenceValue } from "../utils/sequenceGenerator.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sortResults, { searchOffersByCuisineOrCategory } from "../utils/searchHelper.js";
import { log } from "console";
import { getCache, setCache, clearAllCache } from "../utils/cacheHelper.js";
import { uploadImageToGCS, deleteAllOffersByNameForRestaurant } from '../service/storageService.js';
import { writeExcelFileWithExcelJS } from "../middleware/excelManager.js";

//process.cwd() = where the Node app is executed from
//__dirname = where the current script file resides.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create or update an offer
 */
export const addOrUpdateOffer = async (req, res) => {
  try {
    const {
      id,
      title,
      description,
      restaurantId,
      cuisine,
      originalPrice,
      discountedPrice,
      offerType,
      validFrom,
      validTo,
      location,
      country,
      category,
      restaurantName,
    } = req.body;
    //log("Received offer data:", req.body);
    const offerId = await getNextSequence("offers");
    const saveToDB = process.env.SAVE_IMAGES_TO_DB === "true";
    //Normalize to end of day (23:59:59)
    const normalizedValidTo = new Date(validTo);
    normalizedValidTo.setHours(23, 59, 59, 999);

    let updateData = {
      id: offerId,
      title,
      description,
      restaurantId,
      cuisine,
      originalPrice,
      discountedPrice,
      offerType,
      validFrom,
      validTo: normalizedValidTo,
      location,
      country,
      category,
      active: false,   // Set new offers as inactive by default
      restaurantName: restaurantName,
      ownerLogin: req.user.email, // Set ownerLogin from authenticated user's email
    };

    //Get the ownwerLogin from restaurant and verify ownership
    const restaurant = await Restaurant.findOne({ id: restaurantId });
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    if (restaurant.ownerLogin !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Forbidden: You do not own this restaurant" });
    }
    //if restaurantName is not provided, use the restaurant's name
    if (!updateData.restaurantName) {
      updateData.restaurantName = restaurant?.name;
    }
    // ===== Handle image upload =====
    if (req.file) {
      if (saveToDB) {
        try {
          // ✅ Save image in MongoDB or upload to GCS
          //updateData.image = req.file.buffer;
          //updateData.imageType = req.file.mimetype;
          // Upload to GCS instead of MongoDB
          //log(`Uploading image started for offer: ${title || offerId}`);
          const gcsUrl = await uploadImageToGCS(req.file, null, restaurantId, title, offerId);
          updateData.imageUrl = gcsUrl;
          log(`Offer image uploaded to GCS: ${gcsUrl}`);
          // Clear legacy binary data fields if they exist
          updateData.image = null;
          updateData.imageType = null;
        } catch (uploadError) {
          console.error("Upload Service Failed:", uploadError);
          log("Falling back to saving image in MongoDB.");
          // Fallback: save in MongoDB  
          updateData.image = req.file.buffer;
          updateData.imageType = req.file.mimetype;
          //return res.status(500).json({ error: "Failed to upload image to cloud storage." });
        }
      } else {
        // ✅ Save image to filesystem
        const folderPath = path.join(__dirname, "../uploads/offers");
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
        const filePath = path.join(folderPath, `offer-${offerId}.jpg`);
        fs.writeFileSync(filePath, req.file.buffer);
      }
    }

    // ===== Upsert (update or insert new) =====
    const offer = await Offer.findOneAndUpdate({ id: offerId }, updateData, {
      upsert: true,
      new: true,
    });

    //console.log("Cache cleared after offer add/update.");
    console.log("Saved offer and is inactive now :", offerId);

    res.status(200).json({ success: true, offer });
  } catch (err) {
    console.error("Error saving offer:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Update an existing offer
 */
export const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      restaurantId,
      cuisine,
      originalPrice,
      discountedPrice,
      offerType,
      validFrom,
      validTo,
      location,
      country,
      category,
      active,
      restaurantName,
      updateImage
    } = req.body;

    const offerId = parseInt(id, 10);
    if (isNaN(offerId)) {
      return res.status(400).json({ message: "Invalid offer ID" });
    }
    //Normalize to end of day (23:59:59)
    const normalizedValidTo = new Date(validTo);
    normalizedValidTo.setHours(23, 59, 59, 999);

    // Find the existing offer
    const existingOffer = await Offer.findOne({ id: offerId });
    if (!existingOffer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    // Verify ownership of the existing offer
    if (existingOffer.ownerLogin !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Forbidden: You do not own this offer" });
    }
    let parsedRestaurantId = parseInt(restaurantId, 10);
    // If restaurantId is being changed, verify ownership of the new restaurant
    let updatedRestaurantName = restaurantName;
    if (parsedRestaurantId && parsedRestaurantId !== existingOffer.restaurantId) {
      const restaurant = await Restaurant.findOne({ id: parsedRestaurantId });
      if (!restaurant) {
        return res.status(404).json({ message: "New restaurant not found" });
      }
      if (restaurant.ownerLogin !== req.user.email && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden: You do not own the new restaurant" });
      }
      // Auto-update restaurantName if not explicitly provided
      if (!updatedRestaurantName) {
        updatedRestaurantName = restaurant.name;
      }
    }

    let updateData = {
      title,
      description,
      restaurantId: parsedRestaurantId,
      cuisine,
      originalPrice,
      discountedPrice,
      offerType,
      validFrom,
      validTo: normalizedValidTo,
      location,
      country,
      category,
      restaurantName: updatedRestaurantName
    };

    // Only update active if explicitly provided
    if (active !== undefined) {
      updateData.active = active;
    }

    const saveToDB = process.env.SAVE_IMAGES_TO_DB === "true";
    const shouldUpdateImage = updateImage === 'true' || updateImage === true;

    // ===== Handle image update/delete =====
    if (shouldUpdateImage) {
      //get the title from imageUrl from request without extension(.)
      const imageUrl = req.body.imageUrl;
      const deleteTitle = imageUrl.substring(imageUrl.lastIndexOf("/") + 1).split('.')[0];

      // 1. Delete the old image
      if (saveToDB) {
        try {
          // If images are stored in GCS, delete them
          //console.log("Deleting old GCS image for offer: " + deleteTitle);
          await deleteAllOffersByNameForRestaurant(existingOffer.restaurantId, deleteTitle);
          //log(`Deleted old GCS image for offer: ${deleteTitle}`);
        } catch (delError) {
          console.error("Failed to delete old image from GCS:", delError);
        }
        // Reset image fields to be replaced or cleared
        updateData.imageUrl = null;
        updateData.image = null;
        updateData.imageType = null;
      } else {
        // Delete from local filesystem
        const filePath = path.join(__dirname, "../uploads/offers", `offer-${offerId}.jpg`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          log(`Deleted old local image for offer: ${offerId}`);
        }
      }

      // 2. Upload the new image if provided
      if (req.file) {
        if (saveToDB) {
          try {
            // if title and deleteTitle are same then use differentName(-1, -2, -3 etc)
            let differentName = title || existingOffer.title;

            //get the last character of deleteTitle
            const lastChar = deleteTitle.charAt(deleteTitle.length - 1);
            //if last character is a number then increment it
            if (!isNaN(lastChar)) {
              differentName = title + "-" + (parseInt(lastChar) + 1);
            } else {
              differentName = title + "-1";
            }

            const gcsUrl = await uploadImageToGCS(
              req.file,
              null,
              parsedRestaurantId || existingOffer.restaurantId,
              differentName,
              offerId
            );
            updateData.imageUrl = gcsUrl;
            log(`New offer image uploaded to GCS: ${gcsUrl}`);
          } catch (uploadError) {
            console.error("Upload Service Failed:", uploadError);
            log("Falling back to saving image in MongoDB.");
            updateData.image = req.file.buffer;
            updateData.imageType = req.file.mimetype;
          }
        } else {
          const folderPath = path.join(__dirname, "../uploads/offers");
          if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
          const filePath = path.join(folderPath, `offer-${offerId}.jpg`);
          fs.writeFileSync(filePath, req.file.buffer);
          log(`New local image saved for offer: ${offerId}`);
        }
      }
    }

    const updatedOffer = await Offer.findOneAndUpdate({ id: offerId }, updateData, {
      new: true,
    });

    console.log("Updated offer:", offerId);
    res.status(200).json({ success: true, offer: updatedOffer });
  } catch (err) {
    console.error("Error updating offer:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Bulk sync restaurantName for all offers based on status
 * status: 'active' or 'inactive'
 * include offerIds: array of offerIds to sync
 * if provided, sync only those offers
 * sample request body: { "offerIds": ["1", "2", "3"] }
 */
export const syncRestaurantNames = async (req, res) => {
  try {
    const { status } = req.params;
    const { offerIds } = req.body;
    let query = {};

    if (status === 'active') {
      query = { active: true, validTo: { $gte: new Date() } };
    } else if (status === 'inactive') {
      query = { $or: [{ active: { $ne: true } }, { validTo: { $lt: new Date() } }] };
    } else if (status === 'all') {
      query = {}; // Sync everything
    } else {
      return res.status(400).json({ message: "Invalid status parameter. Use 'active', 'inactive', or 'all'." });
    }
    //if offerIds are provided, sync only those offers
    if (offerIds && offerIds.length > 0) {
      query.id = { $in: offerIds };
    }
    log(`Syncing restaurant names for query: ${JSON.stringify(query)}`);
    const offers = await Offer.find(query);
    log(`Syncing restaurant names for ${offers.length} ${status} offers...`);

    let updatedCount = 0;
    // Grouping by restaurantId to minimize DB calls for restaurant data
    const restaurantCache = new Map();

    for (const offer of offers) {
      let rName = restaurantCache.get(offer.restaurantId);

      if (!rName) {
        const restaurant = await Restaurant.findOne({ id: offer.restaurantId });
        if (restaurant) {
          rName = restaurant.name;
          restaurantCache.set(offer.restaurantId, rName);
        }
      }

      if (rName) {
        await Offer.updateOne({ _id: offer._id }, { $set: { restaurantName: rName } });
        updatedCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully synced restaurant names for ${updatedCount} offers out of ${offers.length} found.`,
      status: status
    });
  } catch (err) {
    console.error("Error syncing restaurant names:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get all offers
 */
export const getAllOffers = async (req, res) => {
  try {

    const cacheKey = `All_offers`;
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      console.log("Returning response for key:", cacheKey);
      return res.status(200).json(cachedData);
    }
    console.log(`Cache miss for All Offers — querying DB...`);

    // Exclude `image` and `imageType` fields
    // fetch active offers that have not expired yet
    const today = new Date();
    const offers = await Offer.find(
      {
        active: true,  // For both true or absence-{ active: { $ne: false } })
        validTo: { $gte: today },
      },
      "-image -imageType -__v -_id -active -validFrom -ownerLogin" // exclude image binary fields
    );

    // Set imageUrl
    const protocol = process.env.PROTOCOL || req.protocol;
    const baseUrl = `${protocol}://${req.get("host")}`;
    // const data = offers.map((o) => ({
    //   ...o.toObject(),
    //   imageUrl: `${baseUrl}/api/offers/${o.id}/image`,
    // }));
    const data = sortResults(offers, baseUrl);
    // Cache results if not empty
    if (data.length > 0) {
      setCache(cacheKey, data); // Defaul Cache for 3 hours
    }
    console.log(`Cached ${data.length} offers for All Offers`);

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: "Error fetching offers", error: err.message });
  }
};

/**
 * Get all offers by restaurant
 */
export const getOffersByRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const cacheKey = `offers_restaurant_${restaurantId}`;
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      console.log("Returning response for key:", cacheKey);
      return res.status(200).json(cachedData);
    }
    console.log(`Cache miss for offers of restaurant ${restaurantId} — querying DB...`);
    // fetch active offers that have not expired yet
    const today = new Date();
    const offers = await Offer.find(
      {
        restaurantId: Number(restaurantId),
        active: true,  // For both true or absence-{ active: { $ne: false } })
        validTo: { $gte: today },

      }, "-image -imageType "
    );
    // Set imageUrl
    const protocol = process.env.PROTOCOL || req.protocol;
    const baseUrl = `${protocol}://${req.get("host")}`;
    // Determine image URL to display. 
    // If imageType exists, image is saved to DB, so use API endpoint
    // Otherwise, use imageUrl (GCS URL) as its saved to cloud 

    const data = offers.map((o) => ({
      ...o.toObject(),
      imageUrl: o.imageType
        ? `${baseUrl}/api/offers/${o.id}/image`
        : o.imageUrl || null,
    }));
    // Cache results if not empty
    if (data.length > 0) {
      setCache(cacheKey, data); // Defaul Cache for 3 hours
    }
    console.log(` Cached ${data.length} offers for restaurant ${restaurantId}`);

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: "Error fetching offers", error: err.message });
  }
};

export const getOfferById = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await Offer.findOne({ id }, "-image");
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    // Set imageUrl
    const protocol = process.env.PROTOCOL || req.protocol;
    const baseUrl = `${protocol}://${req.get("host")}`;
    const data = {
      ...offer.toObject(),
      imageUrl: offer.imageType
        ? `${baseUrl}/api/offers/${offer.id}/image`
        : offer.imageUrl || null,
    };

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: "Error fetching offer", error: err.message });
  }
};

/**
 * Serve offer image — from DB or filesystem
 */
export const getOfferImage = async (req, res) => {
  const { id } = req.params;

  try {
    const offer = await Offer.findOne({ id });
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    const saveToDB = process.env.SAVE_IMAGES_TO_DB === "true";

    if (saveToDB) {
      // 🧩 Handle cases where Mongo stores Buffer as object with .data[]
      const imageField = offer.image;
      if (imageField) {
        let imageBuffer;

        // Case 1: Direct Buffer
        if (Buffer.isBuffer(imageField)) {
          imageBuffer = imageField;
        }
        // Case 2: Stored as { data: [...], type: 'Buffer' }
        else if (imageField.data) {
          imageBuffer = Buffer.from(imageField.data);
        }

        if (imageBuffer) {
          res.contentType(offer.imageType || "image/jpeg");
          return res.send(imageBuffer);
        }
      }

      return res.status(404).json({ message: "Image not found in database" });
    } else {
      // 📂 Serve from file system
      const folderPath = path.join(__dirname, "../uploads/offers");
      const filePath = path.join(folderPath, `offer-${id}.jpg`);

      if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
      } else {
        return res.status(404).json({ message: "Image not found in file system" });
      }
    }
  } catch (err) {
    console.error("Error fetching offer image:", err);
    res.status(500).json({ message: "Error fetching image", error: err.message });
  }
};

export const getOffersByCuisineOrCategory = async (req, res) => {
  try {
    const { cuisine } = req.params;
    // Set imageUrl
    const protocol = process.env.PROTOCOL || req.protocol;
    const baseUrl = `${protocol}://${req.get("host")}`;
    let offers = await searchOffersByCuisineOrCategory(cuisine, baseUrl);
    //if result is empty, then search based on restaurant - getOffersByRestaurant
    if (offers.length === 0) {
      //find restaurantId based on cuisine
      const restaurant = await Restaurant.findOne({ name: cuisine });
      if (!restaurant) {
        console.log(`No Restaurant also found for search key: ${cuisine}`);
        return res.status(200).json([]);//return empty array
      }
      console.log(`Restaurant ID for search key ${cuisine}: ${restaurant.id}`);
      //then find offers by restaurantId  using schema 
      const cacheKey = `offers_restaurant_${restaurant.id}`;
      const cachedData = getCache(cacheKey);
      if (cachedData) {
        console.log("Returning response for key:", cacheKey);
        return res.status(200).json(cachedData);
      }
      console.log(`Cache miss for offers of restaurant ${restaurant.id} — querying DB...`);
      // fetch active offers that have not expired yet
      const today = new Date();
      offers = await Offer.find(
        {
          restaurantId: Number(restaurant.id),
          active: true,  // For both true or absence-{ active: { $ne: false } })
          validTo: { $gte: today },

        }, "-image -imageType -__v -_id -active -validFrom -ownerLogin"
      );
    }
    console.log(`Final Offers for cuisine/restaurant ${cuisine}: ${offers.length}`);
    res.status(200).json(offers);
  } catch (err) {
    console.error("Error fetching offers by cuisine:", err);
    res
      .status(500)
      .json({ message: "Error fetching offers by cuisine", error: err.message });
  }
};

/**
 * Delete offer
 */
export const deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;
    // Verify ownership
    const offerToDelete = await Offer.findOne({ id });
    if (!offerToDelete) {
      return res.status(404).json({ message: "Offer not found" });
    }
    // Check if the requester is the owner or an admin
    if (offerToDelete.ownerLogin !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Forbidden: You do not own this offer" });
    }
    const offer = await Offer.findOneAndDelete({ id });
    if (!offer) return res.status(404).json({ message: "Offer not found" });

    // Delete image file if saved on disk
    const saveToDB = process.env.SAVE_IMAGES_TO_DB === "true";
    if (!saveToDB) {
      const filePath = path.join(__dirname, "../uploads/offers", `offer-${id}.jpg`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } else {
      // If images are stored in GCS, consider deleting them from there as well
      deleteAllOffersByNameForRestaurant(offer.restaurantId, offer.title);
    }

    res.json({ success: true, message: "Offer deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// endpoint to make the offer active/inactive
// PATCH /api/offers/activate/1
// Content-Type: application/json

// {
//   "active": true
// }

export const activateOffer = async (req, res) => {
  try {
    const offerId = parseInt(req.params.id, 10);
    const { active, validTill } = req.body;

    if (isNaN(offerId)) {
      return res.status(400).json({ message: "Invalid offer id (must be a number)" });
    }

    // 🕒 If validTill is not given, use today's date
    const effectiveValidTill = validTill ? new Date(validTill) : new Date();

    // ✅ Normalize to end of day (23:59:59)
    effectiveValidTill.setHours(23, 59, 59, 999);

    if (isNaN(effectiveValidTill.getTime())) {
      return res.status(400).json({ message: "Invalid validTill date" });
    }

    const updatedOffer = await Offer.findOneAndUpdate(
      { id: offerId },
      {
        $set: {
          active: active ?? true,
          validTo: effectiveValidTill,
        },
      },
      { new: true, projection: "-image -imageType" } // 🚫 exclude image fields
    );

    if (!updatedOffer) {
      return res.status(404).json({ message: "Offer not found" });
    }
    log(`Offer ${offerId} set to active=${active}, validTo=${effectiveValidTill}`);
    // Clear cache after offer activation/deactivation
    //change stream will handle this while activation
    //deleteCache(updatedOffer.cuisine);
    //deleteCache(updatedOffer.category);
    //deleteCache('All_offers');
    //console.log("Cache cleared after offer activation/deactivation.");

    res.status(200).json({
      message: `Offer ${active === false ? "deactivated" : "activated"} successfully`,
      offer: updatedOffer,
    });
  } catch (err) {
    console.error("Error updating offer status:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// bulk activate/deactivate offers
// PATCH /api/offers/activate-multiple
// Content-Type: application/json

// {
//   "offerIds": [1, 2, 355],
//   "active": false
// }
export const bulkActivateOffers = async (req, res) => {
  try {
    const { offerIds, active, validTill, updates } = req.body;

    if (!Array.isArray(offerIds) || offerIds.length === 0) {
      return res.status(400).json({ message: "offerIds must be a non-empty array" });
    }
    //console.log("updates", JSON.stringify(updates));
    //console.log("offerIds", offerIds);
    //console.log("validTill", validTill);
    //console.log("active", active);
    const numericIds = offerIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
    const normalizedGlobalValidTo = validTill ? new Date(validTill) : null;
    if (normalizedGlobalValidTo && isNaN(normalizedGlobalValidTo.getTime())) {
      return res.status(400).json({ message: "Invalid global validTill date" });
    }
    if (normalizedGlobalValidTo) normalizedGlobalValidTo.setHours(23, 59, 59, 999);

    const isActive = active ?? true;
    let resultCount = 0;

    // Case 1: No updates list - use simple updateMany for global values
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      const updatePayload = { active: isActive };
      if (normalizedGlobalValidTo) {
        updatePayload.validTo = normalizedGlobalValidTo;
      } else {
        // If no global date and no updates, we still need a default date if activating?
        // Original logic used new Date() as default, but let's keep it flexible
        updatePayload.validTo = new Date();
        updatePayload.validTo.setHours(23, 59, 59, 999);
      }

      const result = await Offer.updateMany(
        { id: { $in: numericIds } },
        { $set: updatePayload }
      );
      resultCount = result.modifiedCount;
    }
    // Case 2: Updates list present - perform individual updates using bulkWrite
    else {
      const bulkOps = numericIds.map((offerId) => {
        const individualUpdate = updates.find(u => parseInt(u.id, 10) === offerId) || {};
        const updateFields = { active: isActive };

        // Logic for validTo: Global override takes precedence
        if (normalizedGlobalValidTo) {
          updateFields.validTo = normalizedGlobalValidTo;
        } else if (individualUpdate.validTo) {
          const date = new Date(individualUpdate.validTo);
          date.setHours(23, 59, 59, 999);
          if (!isNaN(date.getTime())) {
            updateFields.validTo = date;
          }
        }

        // Add prices if they exist in individual update
        if (individualUpdate.originalPrice !== undefined) {
          updateFields.originalPrice = parseFloat(individualUpdate.originalPrice);
        }
        if (individualUpdate.discountedPrice !== undefined) {
          updateFields.discountedPrice = parseFloat(individualUpdate.discountedPrice);
        }

        return {
          updateOne: {
            filter: { id: offerId },
            update: { $set: updateFields }
          }
        };
      });

      const bulkResult = await Offer.bulkWrite(bulkOps);
      resultCount = bulkResult.modifiedCount;
    }

    log(`Bulk processing complete. ModifiedCount: ${resultCount}`);

    res.status(200).json({
      success: true,
      message: `Offers ${isActive === false ? "deactivated" : "activated"} and updated successfully`,
      modifiedCount: resultCount,
    });
  } catch (err) {
    console.error("Error in bulk update processing:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Inactivate offers based on ids in request body
//{ 
//   "offerIds": [81, 82, 83, 84] 
//}
export const inActivateOffers = async (req, res) => {
  try {
    const { offerIds } = req.body; // e.g. { offerIds: [1, 2, 3] }

    if (!Array.isArray(offerIds) || offerIds.length === 0) {
      return res.status(400).json({ message: "offerIds must be a non-empty array" });
    }

    // convert all to numbers
    const numericIds = offerIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

    const result = await Offer.updateMany(
      { id: { $in: numericIds } },
      {
        $set: {
          active: false,
        },
      }
    );
    //console.log(`Inactivate offers result:`, result);

    res.status(200).json({
      message: `Offers inactivated successfully`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("Error inactivating offers:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Fetch all inactive offers . REsponse does not include image fields
// GET /api/offers/inactive  return offer id and title
export const getInactiveOffers = async (req, res) => {
  try {
    //add expired offer condition also as OR condition
    const inactiveOffers = await Offer.find(
      { $or: [{ active: { $ne: true } }, { validTo: { $lt: new Date() } }] },
      "-image -imageType -__v"
    ).sort({ id: 1 }); // sort by validTo ascending
    log(`Fetched ${inactiveOffers.length} inactive offers.`);
    res.status(200).json(inactiveOffers);
  } catch (err) {
    console.error("Error fetching inactive offers:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Fetch all active offers . REsponse does not include image fields
// GET /api/offers/all/active  return offer id and title
export const getActiveOffers = async (req, res) => {
  try {
    const activeOffers = await Offer.find(
      {
        active: true,
        validTo: { $gte: new Date() },
      },
      "-image -imageType -__v" // select only specific fields
    ).sort({ id: 1 }); // sort by validTo ascending
    log(`Fetched ${activeOffers.length} active offers.`);
    res.status(200).json(activeOffers);
  } catch (err) {
    console.error("Error fetching active offers:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

//get all expired offers
export const getExpiredOffers = async (req, res) => {
  try {
    const today = new Date();
    const expiredOffers = await Offer.find(
      { validTo: { $lt: today } },
      "id title restaurantId restaurantName cuisine category validTo" // select only specific fields
    ).sort({ validTo: -1 }); // sort by validTo ascending
    log(`Fetched ${expiredOffers.length} expired offers.`);
    res.status(200).json(expiredOffers);
  } catch (err) {
    console.error("Error fetching expired offers:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

//delete all expired offers
export const deleteExpiredOffers = async (req, res) => {
  try {
    const today = new Date();
    const result = await Offer.deleteMany({ validTo: { $lt: today } });
    log(`Deleted ${result.deletedCount} expired offers.`);
    // Clear cache after deleting expired offers
    clearAllCache();
    console.log("All Caches cleared after deleting expired offers.");

    res.status(200).json({
      message: `Deleted ${result.deletedCount} expired offers successfully`,
    });
  } catch (err) {
    console.error("Error deleting expired offers:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
//delete all offers - use with caution
export const deleteAllOffers = async (req, res) => {
  try {
    const result = await Offer.deleteMany({});
    log(`Deleted all offers, count: ${result.deletedCount}`);
    // Clear cache after deleting all offers
    clearAllCache();
    console.log("All Caches cleared after deleting all offers.");
    res.status(200).json({
      message: `Deleted all offers successfully, count: ${result.deletedCount}`,
    });
    //set sequence back to 0
    await setSequenceValue("offers", 0);
  } catch (err) {
    console.error("Error deleting all offers:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete images of offer for a restaurant
export const deleteOfferImagesByRestaurant = async (req, res) => {
  try {
    const { restaurantId, offerId } = req.params;
    //Find offer name from offerId
    const offer = await Offer.findOne({ id: offerId });
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }
    const offerName = offer.title;
    // 1. Delete all offers folder for this restaurant
    await deleteAllOffersByNameForRestaurant(restaurantId, offerName);

    res.status(200).json({
      message: `Deleted offer images for restaurant ${restaurantId}-${offerId} successfully`,
    });
  } catch (err) {
    console.error("Error deleting offer images for restaurant:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Download all offers as Excel
export const downloadOffersExcel = async (req, res) => {
  try {
    const offers = await Offer.find({}).sort({ id: 1 });

    const columns = [
      { header: "id", key: "id", width: 10 },
      { header: "title", key: "title", width: 30 },
      { header: "description", key: "description", width: 40 },
      { header: "restaurantId", key: "restaurantId", width: 15 },
      { header: "restaurantName", key: "restaurantName", width: 30 },
      { header: "regEmail", key: "regEmail", width: 30 },
      { header: "cuisine", key: "cuisine", width: 20 },
      { header: "originalPrice", key: "originalPrice", width: 15 },
      { header: "discountedPrice", key: "discountedPrice", width: 15 },
      { header: "offerType", key: "offerType", width: 15 },
      { header: "validFrom", key: "validFrom", width: 15 },
      { header: "validTo", key: "validTo", width: 15 },
      { header: "location", key: "location", width: 20 },
      { header: "country", key: "country", width: 15 },
      { header: "category", key: "category", width: 20 },
      { header: "imageUrl", key: "imageUrl", width: 50 },
      { header: "imagePath", key: "imagePath", width: 50 },
    ];

    const data = offers.map((offer) => ({
      id: offer.id,
      title: offer.title,
      description: offer.description,
      restaurantId: offer.restaurantId,
      restaurantName: offer.restaurantName,
      regEmail: offer.ownerLogin,
      cuisine: offer.cuisine,
      originalPrice: offer.originalPrice,
      discountedPrice: offer.discountedPrice,
      offerType: offer.offerType,
      validFrom: offer.validFrom ? offer.validFrom.toISOString().split('T')[0] : "",
      validTo: offer.validTo ? offer.validTo.toISOString().split('T')[0] : "",
      location: offer.location,
      country: offer.country,
      category: offer.category,
      imageUrl: offer.imageUrl,
      imagePath: "", // Placeholder as it's not in the model
    }));

    await writeExcelFileWithExcelJS(res, data, "Offers", columns, "offers.xlsx");
  } catch (err) {
    console.error("Error exporting offers to Excel:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
