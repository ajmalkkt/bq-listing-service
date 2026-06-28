import Provider from "../models/Provider.js";
import Listing from "../models/Listing.js";
import { getNextSequence } from "../utils/sequenceGenerator.js";
import { log } from "console";
import { uploadImageToGCS, deleteProviderImages, deleteAllListingImagesForProvider } from "../service/storageService.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get all providers (public)
 */
export const getAllProviders = async (req, res) => {
  try {
    const { verticalId, type, active } = req.query;
    const query = {};
    if (verticalId) query.verticalId = verticalId;
    if (type) query.type = type;
    if (active !== undefined) query.active = active === "true";

    const providers = await Provider.find(query)
      .select("-logoImage -brandImage") // exclude binary blobs
      .sort({ createdAt: -1 });

    const protocol = process.env.PROTOCOL || req.protocol;
    const baseUrl = `${protocol}://${req.get("host")}`;

    const data = providers.map((p) => {
      const obj = p.toObject();
      if (obj.logoUrl && !obj.logoUrl.startsWith("http")) obj.logoUrl = `${baseUrl}${obj.logoUrl}`;
      if (obj.bannerUrl && !obj.bannerUrl.startsWith("http")) obj.bannerUrl = `${baseUrl}${obj.bannerUrl}`;
      return obj;
    });

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: "Error fetching providers", error: err.message });
  }
};

/**
 * Get providers owned by the authenticated user
 */
export const getMyProviders = async (req, res) => {
  try {
    const ownerLogin = req.user?.email;
    if (!ownerLogin) return res.status(401).json({ message: "Unauthorized" });

    const query = req.user.role === "admin" ? {} : { ownerLogin };
    const providers = await Provider.find(query)
      .select("-logoImage -brandImage")
      .sort({ createdAt: -1 });

    res.status(200).json(providers);
  } catch (err) {
    res.status(500).json({ message: "Error fetching providers", error: err.message });
  }
};

/**
 * Get provider by id
 */
export const getProviderById = async (req, res) => {
  try {
    const provider = await Provider.findOne({ id: parseInt(req.params.id) })
      .select("-logoImage -brandImage");
    if (!provider) return res.status(404).json({ message: "Provider not found" });
    res.status(200).json(provider);
  } catch (err) {
    res.status(500).json({ message: "Error fetching provider", error: err.message });
  }
};

/**
 * Create a provider
 */
export const createProvider = async (req, res) => {
  try {
    const data = req.body;
    const saveToDB = process.env.SAVE_IMAGES_TO_DB === "true";
    const providerId = await getNextSequence("providers");

    const newProviderData = {
      ...data,
      id: providerId,
      ownerLogin: req.user?.email || "admin",
    };

    // Handle logo upload
    if (req.files?.logo?.[0]) {
      const file = req.files.logo[0];
      if (saveToDB) {
        try {
          const gcsUrl = await uploadImageToGCS(file, null, providerId, data.name, providerId, "providers");
          newProviderData.logoUrl = gcsUrl;
        } catch (err) {
          console.error("Logo upload failed:", err);
        }
      } else {
        const folderPath = path.join(__dirname, "../uploads/providers");
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
        const filePath = path.join(folderPath, `provider-${providerId}-logo.jpg`);
        fs.writeFileSync(filePath, file.buffer);
        newProviderData.logoUrl = `/uploads/providers/provider-${providerId}-logo.jpg`;
      }
    }

    // Handle banner upload
    if (req.files?.banner?.[0]) {
      const file = req.files.banner[0];
      if (saveToDB) {
        try {
          const gcsUrl = await uploadImageToGCS(file, null, providerId, `${data.name}-banner`, providerId, "providers");
          newProviderData.bannerUrl = gcsUrl;
        } catch (err) {
          console.error("Banner upload failed:", err);
        }
      } else {
        const folderPath = path.join(__dirname, "../uploads/providers");
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
        const filePath = path.join(folderPath, `provider-${providerId}-banner.jpg`);
        fs.writeFileSync(filePath, file.buffer);
        newProviderData.bannerUrl = `/uploads/providers/provider-${providerId}-banner.jpg`;
      }
    }

    const provider = new Provider(newProviderData);
    await provider.save();
    log(`Created provider: ${providerId} (${data.name})`);
    res.status(201).json({ success: true, provider });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Update a provider
 */
export const updateProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const saveToDB = process.env.SAVE_IMAGES_TO_DB === "true";
    const updateData = { ...data };

    // Fetch existing for fallback values
    const existing = await Provider.findOne({ id: parseInt(id) });
    if (!existing) return res.status(404).json({ message: "Provider not found" });

    const name = data.name || existing.name;

    // Ownership check
    if (req.user.role !== "admin" && existing.ownerLogin !== req.user?.email) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Handle logo upload
    if (req.files?.logo?.[0]) {
      const file = req.files.logo[0];
      if (saveToDB) {
        try {
          const gcsUrl = await uploadImageToGCS(file, null, id, name, id, "providers");
          updateData.logoUrl = gcsUrl;
        } catch (err) { console.error("Logo upload failed:", err); }
      } else {
        const folderPath = path.join(__dirname, "../uploads/providers");
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
        const filePath = path.join(folderPath, `provider-${id}-logo.jpg`);
        fs.writeFileSync(filePath, file.buffer);
        updateData.logoUrl = `/uploads/providers/provider-${id}-logo.jpg`;
      }
    }

    // Handle banner upload
    if (req.files?.banner?.[0]) {
      const file = req.files.banner[0];
      if (saveToDB) {
        try {
          const gcsUrl = await uploadImageToGCS(file, null, id, `${name}-banner`, id, "providers");
          updateData.bannerUrl = gcsUrl;
        } catch (err) { console.error("Banner upload failed:", err); }
      } else {
        const folderPath = path.join(__dirname, "../uploads/providers");
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
        const filePath = path.join(folderPath, `provider-${id}-banner.jpg`);
        fs.writeFileSync(filePath, file.buffer);
        updateData.bannerUrl = `/uploads/providers/provider-${id}-banner.jpg`;
      }
    }

    const updated = await Provider.findOneAndUpdate(
      { id: parseInt(id) },
      { $set: updateData },
      { new: true }
    );
    res.status(200).json({ success: true, provider: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Delete a provider (admin only)
 */
export const deleteProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Provider.findOneAndDelete({ id: parseInt(id) });
    if (!deleted) return res.status(404).json({ message: "Provider not found" });
    log(`Deleted provider: ${id}`);
    //Delete associated images from gcs storage.
    await deleteProviderImages(id);
    // Delete associated listings
    await deleteListingsByProvider(id);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Delete listing and images when providerId is deleted (admin only).
 * This function can take one provider attribute (id) and delete all listings associated with that provider.
 */
export const deleteListingsByProvider = async (providerId) => {
  try {
    log(`Deleting listings for provider: ${providerId}`);
    // If you need the actual documents back before they vanish:
    //const deletedDocs = await Listing.find({ providerId: parseInt(providerId) });
    const deletedListings = await Listing.deleteMany({ providerId: parseInt(providerId) });
    // Delete associated images from GCS storage using deleteAllListingImagesForProvider
    await deleteAllListingImagesForProvider(providerId);
    log(`Deleted ${deletedListings.deletedCount} listings for provider: ${providerId}`);
  } catch (err) {
    log(`Error deleting listings for provider ${providerId}:`, err);
  }
};