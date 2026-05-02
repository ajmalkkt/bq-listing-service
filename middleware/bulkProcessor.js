import fs from "fs-extra";
import mime from "mime-types";
import path from "path";
import Restaurant from "../models/Restaurant.js";
import Offer from "../models/Offer.js";
import { getNextSequence, setSequenceValue } from "../utils/sequenceGenerator.js";
import { getFilesIfExists } from "../utils/fileUtils.js";
import { clearAllCache } from "../utils/cacheHelper.js";
import { log } from "console";
import { readExcelFileWithExcelJS } from "./excelManager.js";
import { uploadImageToGCS, uploadRestaurantImageToGCS } from '../service/storageService.js';

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "bulk");

export const processBulkUploads = async (req) => {
  try {

    log(` Checking for bulk upload files... Folder:${UPLOAD_DIR}`);

    const files = getFilesIfExists(UPLOAD_DIR);
    if (files.length === 0) {
      log("[BulkProcessor] No Excel files found. Skipping run.");
      return;
    }

    log(`[BulkProcessor] Found ${files.length} file(s):`);
    let fileCount = files.length;
    for (const file of files) {
      if (!file.endsWith(".xlsx")) {
        log(`Skipping non-Excel file: ${file}`);
        fileCount--;
        continue;
      }

      const filePath = path.join(UPLOAD_DIR, file);
      log(`Processing file: ${filePath}`);

      const data = await readExcelFileWithExcelJS(filePath);
      //log(data);

      if (file.includes("restaurant")) {
        await importRestaurants(data, req);
      } else if (file.includes("offer")) {
        await importOffers(data, req);
      }

      // Move processed file to archive
      const archivePath = path.join(UPLOAD_DIR, "processed");
      await fs.ensureDir(archivePath);
      await fs.move(filePath, path.join(archivePath, file), { overwrite: true });

      console.log(`Finished processing ${file}`);
    }
    console.log("Bulk upload processing completed for " + fileCount + " files");
  } catch (err) {
    console.error("Error in bulk upload processor:", err);
  }
};

const sanitizeExcelEmail = async (cellValue) => {
  if (!cellValue) return '';

  let email = '';

  // Case 1: It's an object (Hyperlink structure like { text: '...', hyperlink: '...' })
  if (typeof cellValue === 'object' && cellValue !== null) {
    // Use .text if available, otherwise check if .result exists (common in formulas)
    email = cellValue.text || cellValue.result || '';
  }
  // Case 2: It's already a string
  else if (typeof cellValue === 'string') {
    email = cellValue;
  }

  // Cleanup: Convert to string (safety), trim whitespace, remove 'mailto:' if present
  return email
    .toString()
    .trim()
    .replace(/^mailto:/i, '') // Remove mailto: prefix if it got included
    .toLowerCase();
};

const importRestaurants = async (rows, req) => {
  for (const row of rows) {
    const {
      id,
      name,
      address,
      regEmail,
      phone,
      rating,
      rank,
      cuisine,
      logoUrl,
      brandUrl,
      country,
      logoImagePath,
      brandImagePath,
    } = row;
    const cleanEmail = await sanitizeExcelEmail(regEmail);
    //console.log(`Importing restaurant: ${row} `);
    let restaurantId = id || await getNextSequence("restaurants");

    const updateData = {
      id: restaurantId,
      name,
      address,
      phone,
      rating,
      rank,
      cuisine: cuisine?.split(",").map(c => c.trim()) || [],
      logoUrl,
      brandUrl,
      country,
      ownerLogin: cleanEmail,
    };

    // Set imageUrl
    const protocol = process.env.PROTOCOL || req.protocol;
    const baseUrl = `${protocol}://${req.get("host")}`;

    // Attach image files if paths exist
    if (!logoUrl && logoImagePath && fs.existsSync(logoImagePath)) {
      const imageBuffer = fs.readFileSync(logoImagePath);
      const imageType = mime.lookup(logoImagePath); // returns 'image/png' or 'image/jpeg'

      //const extWithDot = path.extname(logoImagePath); 
      // Returns 'png' (no dot)
      //const ext = extWithDot.slice(1).toLowerCase(); 
      //updateData.logoImage = imageBuffer;
      //updateData.logoImageType = imageType || 'application/octet-stream';
      //updateData.logoUrl = `${baseUrl}/api/restaurants/${restaurantId}/image/logo`;
      try {
        const gcsUrl = await uploadRestaurantImageToGCS(
          imageBuffer, "logo", imageType, restaurantId, name);
        updateData.logoUrl = gcsUrl;
        log(`Logo image for Id:${restaurantId} uploaded to GCS: ${gcsUrl}`);
        updateData.logoImage = null;
        updateData.logoImageType = null;
      } catch (uploadErr) {
        console.error("Error uploading Logo to GCS:", uploadErr);
        //Fallback to DB storage
        updateData.logoImage = imageBuffer;
        updateData.logoImageType = imageType;
        //return res.status(500).json({ error: "Error uploading Brand image" });
      }
    }
    //currently showing brand image in popular brand section
    if (!brandUrl && brandImagePath && fs.existsSync(brandImagePath)) {
      const imageBuffer = fs.readFileSync(brandImagePath);
      const imageType = mime.lookup(brandImagePath);
      //updateData.brandImage = imageBuffer;//fs.readFileSync(brandImagePath);
      //updateData.brandImageType = imageType || 'application/octet-stream';
      //updateData.brandUrl = `${baseUrl}/api/restaurants/${restaurantId}/image/brand`;
      //const extWithDot = path.extname(brandImagePath); 
      // Returns 'png' (no dot)
      //const ext = extWithDot.slice(1).toLowerCase();
      try {
        const gcsUrl = await uploadRestaurantImageToGCS(
          imageBuffer, "brand", imageType, restaurantId, name);
        updateData.brandUrl = gcsUrl;
        log(`Brand image for Id:${restaurantId} uploaded to GCS: ${gcsUrl}`);
        updateData.brandImage = null;
        updateData.brandImageType = null;
      } catch (uploadErr) {
        console.error("Error uploading Brand to GCS:", uploadErr);
        //Fallback to DB storage
        updateData.brandImage = imageBuffer;
        updateData.brandImageType = imageType;
        //return res.status(500).json({ error: "Error uploading Brand image" });
      }
    } else if (!brandUrl && (!brandImagePath || !fs.existsSync(brandImagePath))) {
      console.warn(`Brand image not found at path: ${brandImagePath}`);
      return;
    }

    await Restaurant.findOneAndUpdate(
      { id: restaurantId },
      updateData,
      { upsert: true, new: true }
    );
  }
  console.log("Restaurants imported/updated successfully.");
  // 2. Find the maximum ID in the data you just uploaded
  // (Or query the DB for the absolute max ID to be safe)
  const maxRestaurant = await Restaurant.findOne().sort({ id: -1 }).select('id');
  const maxId = maxRestaurant ? maxRestaurant.id : 0;

  // 3. Reset the sequence so the next manually added offer doesn't conflict
  await setSequenceValue("restaurants", maxId);
  //log(`Restaurant Sequence reset to: ${maxId}`);
};

const importOffers = async (rows, req) => {
  for (const row of rows) {
    const {
      id,
      title,
      description,
      restaurantId,
      restaurantName,
      regEmail,
      cuisine,
      originalPrice,
      discountedPrice,
      offerType,
      validFrom,
      validTo,
      location,
      country,
      category,
      imageUrl,
      imagePath,
    } = row;

    const cleanEmail = await sanitizeExcelEmail(regEmail);
    //Get the ownwerLogin from restaurant and verify ownership
    const restaurant = await Restaurant.findOne({ id: restaurantId });
    if (!restaurant) {
      log(`Restaurant not found for offer: ${title || offerId}`);
      continue;
    }
    if (restaurant.ownerLogin !== regEmail) {
      log(`Skipping offer import. User ${regEmail} does not own restaurant ID ${restaurantId}`);
      continue;
    }
    // if restaurantName is not provided then use restaurant name from restaurant
    if (!restaurantName) {
      restaurantName = restaurant.name;
    }

    let offerId = id || await getNextSequence("offers");

    const updateData = {
      id: offerId,
      title,
      description,
      restaurantId,
      cuisine,
      originalPrice,
      discountedPrice,
      offerType,
      validFrom,
      validTo,
      imageUrl,
      location,
      country,
      category,
      active: true, // Mark offer as active upon bulk import
      restaurantName: restaurantName,
      ownerLogin: cleanEmail,
    };
    //if imageUrl is not provided then upload image to GCS
    if (!imageUrl && imagePath && fs.existsSync(imagePath)) {
      const imageBuffer = fs.readFileSync(imagePath);
      const imageType = mime.lookup(imagePath); // returns 'image/png' or 'image/jpeg'
      //updateData.image = imageBuffer;
      //updateData.imageType = imageType || 'application/octet-stream';
      try {
        // Upload to GCS instead of MongoDB
        //log(`Uploading image started for offer: ${title || offerId}`);
        const gcsUrl = await uploadImageToGCS(imageBuffer, imageType, restaurantId, title, offerId);
        updateData.imageUrl = gcsUrl;
        log(`Offer image for Id:${offerId} uploaded to GCS: ${gcsUrl}`);
        // Clear legacy binary data fields if they exist
        updateData.image = null;
        updateData.imageType = null;
      } catch (uploadError) {
        console.error("Upload Service Failed:", uploadError);
        log("Falling back to saving image in MongoDB.");
        // Fallback: save in MongoDB  
        updateData.image = imageBuffer;
        updateData.imageType = imageType;
        //return res.status(500).json({ error: "Failed to upload image to cloud storage." });
      }
    } else if (!imageUrl && (!imagePath || !fs.existsSync(imagePath))) {
      console.warn(`Offer image not found at path: ${imagePath}`);
      return;
    }

    await Offer.findOneAndUpdate(
      { id: offerId },
      updateData,
      { upsert: true, new: true }
    );
  }
  // Clear cache after bulk import
  clearAllCache();
  console.log("Cache cleared after bulk offers import.");
  // 2. Find the maximum ID in the data you just uploaded
  // (Or query the DB for the absolute max ID to be safe)
  const maxOffer = await Offer.findOne().sort({ id: -1 }).select('id');
  const maxId = maxOffer ? maxOffer.id : 0;

  // 3. Reset the sequence so the next manually added offer doesn't conflict
  await setSequenceValue("offers", maxId);
  //log(`Offer Sequence reset to: ${maxId}`);
};
