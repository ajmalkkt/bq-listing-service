import Listing from "../models/Listing.js";
import Provider from "../models/Provider.js";
import Vertical from "../models/Vertical.js";
import { getNextSequence } from "../utils/sequenceGenerator.js";
import { log } from "console";
import { getCache, setCache } from "../utils/cacheHelper.js";
import sortResults from "../utils/searchHelper.js";
import { uploadImageToGCS } from '../service/storageService.js';
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get all listings across all verticals with optional filtering
 * Query params: vertical, category, city, search, status
 */
export const getAllListings = async (req, res) => {
  try {
    const { vertical, category, city, search, status = 'active' } = req.query;
    
    // Create cache key based on query params
    const cacheKey = `listings_${vertical || 'all'}_${category || 'all'}_${city || 'all'}_${search || 'none'}`;
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const query = {};
    if (vertical) query.verticalId = vertical;
    if (category) query.category = category;
    if (city) query["location.city"] = city;
    if (status === 'active') {
      query.active = true;
      query["validity.to"] = { $gte: new Date() };
    } else if (status === 'inactive') {
      query.active = false;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const listings = await Listing.find(query)
      .sort({ createdAt: -1 })
      .limit(100);

    const protocol = process.env.PROTOCOL || req.protocol;
    const baseUrl = `${protocol}://${req.get("host")}`;

    // Map to generic format if needed or just return
    const data = listings.map(l => {
      const obj = l.toObject();
      // Ensure image URL is absolute
      if (obj.imageUrl && !obj.imageUrl.startsWith('http')) {
        obj.imageUrl = `${baseUrl}${obj.imageUrl}`;
      }
      return obj;
    });

    if (data.length > 0) {
      setCache(cacheKey, data);
    }

    res.status(200).json(data);
  } catch (err) {
    console.error("Error fetching listings:", err);
    res.status(500).json({ message: "Error fetching listings", error: err.message });
  }
};

/**
 * Get listing by ID
 */
export const getListingById = async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await Listing.findOne({ id });
    
    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    const protocol = process.env.PROTOCOL || req.protocol;
    const baseUrl = `${protocol}://${req.get("host")}`;
    const obj = listing.toObject();
    
    if (obj.imageUrl && !obj.imageUrl.startsWith('http')) {
      obj.imageUrl = `${baseUrl}${obj.imageUrl}`;
    }

    res.status(200).json(obj);
  } catch (err) {
    res.status(500).json({ message: "Error fetching listing", error: err.message });
  }
};

/**
 * Create listing
 */
export const createListing = async (req, res) => {
  try {
    const data = req.body;
    const listingId = await getNextSequence("listings");
    const saveToDB = process.env.SAVE_IMAGES_TO_DB === "true";
    
    const newListingData = {
      ...data,
      id: listingId,
      ownerLogin: req.user?.email || 'admin'
    };

    // Parse JSON fields
    if (data.pricing) newListingData.pricing = JSON.parse(data.pricing);
    if (data.location) newListingData.location = JSON.parse(data.location);
    if (data.validity) newListingData.validity = JSON.parse(data.validity);
    if (data.attributes) newListingData.attributes = JSON.parse(data.attributes);

    // Handle Main Image
    if (req.files && req.files.image && req.files.image[0]) {
      const file = req.files.image[0];
      if (saveToDB) {
        try {
          const gcsUrl = await uploadImageToGCS(file, null, data.providerId, data.title, listingId, 'listings');
          newListingData.imageUrl = gcsUrl;
        } catch (uploadError) {
          console.error("Upload Service Failed:", uploadError);
        }
      } else {
        const folderPath = path.join(__dirname, "../uploads/listings");
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
        const filePath = path.join(folderPath, `listing-${listingId}.jpg`);
        fs.writeFileSync(filePath, file.buffer);
        newListingData.imageUrl = `/uploads/listings/listing-${listingId}.jpg`;
      }
    }

    // Handle Gallery Images
    if (req.files && req.files.galleryUrls && req.files.galleryUrls.length > 0) {
      newListingData.galleryUrls = [];
      for (let i = 0; i < req.files.galleryUrls.length; i++) {
        const file = req.files.galleryUrls[i];
        if (saveToDB) {
          try {
            const gcsUrl = await uploadImageToGCS(file, null, data.providerId, `${data.title}-gallery-${i}`, listingId, 'listings');
            newListingData.galleryUrls.push(gcsUrl);
          } catch (err) {
            console.error("Gallery upload failed", err);
          }
        } else {
          const folderPath = path.join(__dirname, "../uploads/listings");
          if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
          const filePath = path.join(folderPath, `listing-${listingId}-gallery-${i}.jpg`);
          fs.writeFileSync(filePath, file.buffer);
          newListingData.galleryUrls.push(`/uploads/listings/listing-${listingId}-gallery-${i}.jpg`);
        }
      }
    }

    const newListing = new Listing(newListingData);
    await newListing.save();
    log(`Created new listing: ${listingId} in vertical: ${newListing.verticalId}`);
    
    res.status(201).json({ success: true, listing: newListing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Update listing
 */
export const updateListing = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const saveToDB = process.env.SAVE_IMAGES_TO_DB === "true";
    
    const updateData = { ...data };

    // Parse JSON fields
    if (data.pricing) updateData.pricing = JSON.parse(data.pricing);
    if (data.location) updateData.location = JSON.parse(data.location);
    if (data.validity) updateData.validity = JSON.parse(data.validity);
    if (data.attributes) updateData.attributes = JSON.parse(data.attributes);

    // Provide default fallback variables for title and providerId in case they are not in the update payload
    let title = data.title || `listing-${id}`;
    let providerId = data.providerId || "unknown";

    // Try to fetch existing listing if we need to fall back for title/provider
    if (!data.title || !data.providerId) {
       const existing = await Listing.findOne({ id: parseInt(id) });
       if (existing) {
         if (!data.title) title = existing.title;
         if (!data.providerId) providerId = existing.providerId;
       }
    }

    // Handle Main Image
    if (req.files && req.files.image && req.files.image[0]) {
      const file = req.files.image[0];
      if (saveToDB) {
        try {
          const gcsUrl = await uploadImageToGCS(file, null, providerId, title, id, 'listings');
          updateData.imageUrl = gcsUrl;
        } catch (uploadError) {
          console.error("Upload Service Failed:", uploadError);
        }
      } else {
        const folderPath = path.join(__dirname, "../uploads/listings");
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
        const filePath = path.join(folderPath, `listing-${id}.jpg`);
        fs.writeFileSync(filePath, file.buffer);
        updateData.imageUrl = `/uploads/listings/listing-${id}.jpg`;
      }
    }

    // Handle Gallery Images (Replaces existing gallery for simplicity, or appends depending on requirement)
    if (req.files && req.files.galleryUrls && req.files.galleryUrls.length > 0) {
      updateData.galleryUrls = [];
      for (let i = 0; i < req.files.galleryUrls.length; i++) {
        const file = req.files.galleryUrls[i];
        if (saveToDB) {
          try {
            const gcsUrl = await uploadImageToGCS(file, null, providerId, `${title}-gallery-${i}`, id, 'listings');
            updateData.galleryUrls.push(gcsUrl);
          } catch (err) {
            console.error("Gallery upload failed", err);
          }
        } else {
          const folderPath = path.join(__dirname, "../uploads/listings");
          if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
          const filePath = path.join(folderPath, `listing-${id}-gallery-${i}.jpg`);
          fs.writeFileSync(filePath, file.buffer);
          updateData.galleryUrls.push(`/uploads/listings/listing-${id}-gallery-${i}.jpg`);
        }
      }
    }
    
    const listing = await Listing.findOneAndUpdate(
      { id: parseInt(id) },
      { $set: updateData },
      { new: true }
    );

    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    res.status(200).json({ success: true, listing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get all verticals
 */
export const getVerticals = async (req, res) => {
  try {
    const verticals = await Vertical.find({ enabled: true });
    res.status(200).json(verticals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
