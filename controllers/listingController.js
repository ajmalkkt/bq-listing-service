import Listing from "../models/Listing.js";
import Provider from "../models/Provider.js";
import Vertical from "../models/Vertical.js";
import { getNextSequence } from "../utils/sequenceGenerator.js";
import { log } from "console";
import { getCache, setCache } from "../utils/cacheHelper.js";
import sortResults from "../utils/searchHelper.js";

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
    
    const newListing = new Listing({
      ...data,
      id: listingId,
      ownerLogin: req.user?.email || 'admin'
    });

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
    
    const listing = await Listing.findOneAndUpdate(
      { id: parseInt(id) },
      { $set: data },
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
