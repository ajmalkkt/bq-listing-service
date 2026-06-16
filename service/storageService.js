import { Storage } from '@google-cloud/storage';
import path from 'path';
import { log } from "console";

// 1. Initialize Google Cloud Storage
const storage = new Storage({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS, 
  projectId: process.env.GCLOUD_PROJECT_ID,
});

const bucket = storage.bucket(process.env.GCLOUD_BUCKET_NAME);

/**
 * Helper to sanitize strings for filenames
 * specific to your "Title as Filename" requirement
 */
const sanitizeFilename = (text, fallbackId) => {
  if (!text) return `offer-${fallbackId}`;

  const safeText = text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')         // Replace spaces with -
    .replace(/[^\w\-]+/g, '')     // Remove non-word chars
    .replace(/\-\-+/g, '-');      // Replace multiple -- with single -

  return safeText.length > 0 ? safeText : `offer-${fallbackId}`;
};

/**
 * Uploads a file to Google Cloud Storage
 * 
 * @param {Object} fileObject - The file object from multer (req.file)
 * @param {String} title - The offer title (for filename generation)
 * @param {String|Number} offerId - Fallback ID if title is missing/invalid
 * @param {String} folderName - Folder in bucket (default: 'offers')
 * @returns {Promise<string>} - The public URL of the uploaded image
 */
export const uploadImageToGCS = (fileInput, manualMimeType, restaurantId, title, offerId, folderName = 'offers') => {
  return new Promise((resolve, reject) => {
    if (!fileInput) {
      return reject(new Error('No file provided'));
    }

    let buffer;
    let contentType;

    // 1. Detect Input Type
    if (Buffer.isBuffer(fileInput)) {
      // CASE A: Raw Buffer (from fs.readFileSync)
      if (!manualMimeType) {
        return reject(new Error('MIME type is required when uploading a raw Buffer.'));
      }
      buffer = fileInput;
      contentType = manualMimeType;
    } else if (fileInput && fileInput.buffer) {
      // CASE B: Multer File Object (from req.file)
      buffer = fileInput.buffer;
      contentType = fileInput.mimetype;
    } else {
      return reject(new Error('Invalid file input. Expected Buffer or Multer object.'));
    }

    // 1. Generate Safe Filename
    const safeTitle = sanitizeFilename(title, offerId);
    const extension = contentType.split('/')[1] || 'jpg';
    //In case you want to organize by restaurant, added restaurantId folder
    //final fileName eg. => offers/1/biriyani-1234567890.jpg
    // removing -${Date.now()} for consistent naming
    const fileName = `${folderName}/${restaurantId}/${safeTitle}.${extension}`;
    log(`Uploading image for offer "${title}" as "${safeTitle}",GCS file="${fileName}"`);
    
    const file = bucket.file(fileName);

    // 2. Create Write Stream
    const stream = file.createWriteStream({
      metadata: {
        contentType: contentType,
        cacheControl: 'public, max-age=7776000', //for 3 months. If  31536000 - Cache for 1 year
      },
      resumable: false,
    });

    // 3. Handle Stream Events
    stream.on('error', (err) => {
      console.error('GCS Stream Error:', err);
      reject(err);
    });

    stream.on('finish', () => {
      // 4. Return Public URL
      const publicUrl = `https://storage.googleapis.com/${process.env.GCLOUD_BUCKET_NAME}/${fileName}`;
      resolve(publicUrl);
    });

    // 5. End Stream with Data
    stream.end(buffer);
  });
};

export const uploadRestaurantImageToGCS = (fileInput, imgType, manualMimeType = null, restaurantId, name) => {
  return new Promise((resolve, reject) => {
    if (!fileInput) {
      return reject(new Error('No file provided'));
    }
    let buffer;
    let contentType;

    // 1. Detect Input Type
    if (Buffer.isBuffer(fileInput)) {
      // CASE A: Raw Buffer (from fs.readFileSync)
      if (!manualMimeType) {
        return reject(new Error('MIME type is required when uploading a raw Buffer.'));
      }
      buffer = fileInput;
      contentType = manualMimeType;
    } else if (fileInput && fileInput.buffer) {
      // CASE B: Multer File Object (from req.file)
      buffer = fileInput.buffer;
      contentType = fileInput.mimetype;
    } else {
      return reject(new Error('Invalid file input. Expected Buffer or Multer object.'));
    }
    // 1. Generate Safe Filename
    const safeTitle = sanitizeFilename(name, restaurantId);
    const restaurantFolder = `${safeTitle}-${restaurantId}`;
    const fileTypeName = `${safeTitle}-${imgType}`;
    const extension = contentType.split('/')[1] || 'jpg';
    //In case you want to organize by restaurant, added restaurantId folder
    //final fileName eg. => offers/1/biriyani-1234567890.jpg
    const fileName = `restaurants/${restaurantFolder}/${fileTypeName}.${extension}`;
    log(`Uploading image for Restaurant "${imgType}" "${name}" as "${safeTitle}",GCS file="${fileName}"`);
    
    const file = bucket.file(fileName);

    // 2. Create Write Stream
    const stream = file.createWriteStream({
      metadata: {
        contentType: contentType,
        cacheControl: 'public, max-age=7776000', //for 3 months. If  31536000 - Cache for 1 year
      },
      resumable: false,
    });

    // 3. Handle Stream Events
    stream.on('error', (err) => {
      console.error('GCS Stream Error:', err);
      reject(err);
    });

    stream.on('finish', () => {
      // 4. Return Public URL
      const publicUrl = `https://storage.googleapis.com/${process.env.GCLOUD_BUCKET_NAME}/${fileName}`;
      resolve(publicUrl);
    });

    // 5. End Stream with Data
    stream.end(buffer);
  });
};

/**
 * Deletes ALL offer images for a specific Restaurant
 * Target: offers/${restaurantId}/
 */
export const deleteAllOffersForRestaurant = async (restaurantId) => {
  try {
    const folderPrefix = `offers/${restaurantId}/`;
    log(`Deleting all offer images for restaurant folder: ${folderPrefix}`);
    // deleteFiles handles listing and deleting all files with the prefix
    await bucket.deleteFiles({
      prefix: folderPrefix,
    });
    
    log(`Deleted all offer images for restaurantId: ${restaurantId}`);
  } catch (error) {
    console.error(`Error deleting offers for restaurant ${restaurantId}:`, error);
    throw error;
  }
};

// Delete ALL images for a specific offer of a Restaurant
export const deleteAllOffersByNameForRestaurant = async (restaurantId, offerName) => {
  try {
    const safeOfferTitle = sanitizeFilename(offerName, ''); // Use offerName as fallback
    const filePrefix = `offers/${restaurantId}/${safeOfferTitle}`;
    log(`Deleting image for offer: ${filePrefix}`);
    // deleteFiles handles listing and deleting all files with the prefix
    await bucket.deleteFiles({
      prefix: filePrefix,
    });

    log(`Deleted all images for offerName: ${offerName} of restaurantId: ${restaurantId}`);
  } catch (error) {
    console.error(`Error deleting offer ${offerName} for restaurant ${restaurantId}:`, error);
    throw error;
  } 
};  

/**
 * Deletes the entire Restaurant folder (logos, covers, etc.)
 * Target: restaurants/${sanitizedName}-${restaurantId}/
 * 
 * NOTE: We need the 'name' to reconstruct the folder path exactly as it was created.
 */
export const deleteAllRestaurantImages = async (restaurantId, name) => {
  try {
    const safeTitle = sanitizeFilename(name, restaurantId);
    const restaurantFolder = `restaurants/${safeTitle}-${restaurantId}/`;
    log(`Deleting all images for restaurant folder: ${restaurantFolder}`);
    await bucket.deleteFiles({
      prefix: restaurantFolder,
    });

    log(`Deleted all images for restaurant folder: ${restaurantFolder}`);
  } catch (error) {
    console.error(`Error deleting restaurant folder ${restaurantId}:`, error);
    throw error;
  }
};

// delete all files under offers/  and restaurants/ folders
export const deleteAllImagesFromGCS = async () => {
  try {
    const offersPrefix = `offers/`;
    const restaurantsPrefix = `restaurants/`;

    log(`Deleting all images under folder: ${offersPrefix}`);
    await bucket.deleteFiles({
      prefix: offersPrefix,
    });
    log(`Deleted all images under folder: ${offersPrefix}`);

    log(`Deleting all images under folder: ${restaurantsPrefix}`);
    await bucket.deleteFiles({
      prefix: restaurantsPrefix,
    });
    log(`Deleted all images under folder: ${restaurantsPrefix}`);
  } catch (error) {
    console.error(`Error deleting all images from GCS:`, error);
    throw error;
  }
};


/**
 * Uploads a single menu page image for a restaurant to GCS.
 * Path: restaurants/{safeRestaurantName}-{id}/menu/menu-page-{pageIndex}.{ext}
 */
export const uploadRestaurantMenuImageToGCS = (fileInput, manualMimeType = null, restaurantId, name, pageIndex) => {
  return new Promise((resolve, reject) => {
    if (!fileInput) return reject(new Error('No file provided'));

    let buffer;
    let contentType;

    if (Buffer.isBuffer(fileInput)) {
      if (!manualMimeType) return reject(new Error('MIME type required for raw Buffer.'));
      buffer = fileInput;
      contentType = manualMimeType;
    } else if (fileInput && fileInput.buffer) {
      buffer = fileInput.buffer;
      contentType = fileInput.mimetype;
    } else {
      return reject(new Error('Invalid file input. Expected Buffer or Multer object.'));
    }

    const safeTitle = sanitizeFilename(name, restaurantId);
    const restaurantFolder = `${safeTitle}-${restaurantId}`;
    const extension = contentType.split('/')[1] || 'jpg';
    const fileName = `restaurants/${restaurantFolder}/menu/menu-page-${pageIndex}-${Date.now()}.${extension}`;
    log(`Uploading menu page ${pageIndex} for restaurant "${name}", GCS file="${fileName}"`);

    const file = bucket.file(fileName);
    const stream = file.createWriteStream({
      metadata: {
        contentType,
        cacheControl: 'public, max-age=7776000',
      },
      resumable: false,
    });

    stream.on('error', (err) => { console.error('GCS Menu Stream Error:', err); reject(err); });
    stream.on('finish', () => {
      const publicUrl = `https://storage.googleapis.com/${process.env.GCLOUD_BUCKET_NAME}/${fileName}`;
      resolve(publicUrl);
    });

    stream.end(buffer);
  });
};

/**
 * Deletes a specific menu page image from GCS by its full public URL.
 */
export const deleteRestaurantMenuImage = async (publicUrl) => {
  try {
    const bucketName = process.env.GCLOUD_BUCKET_NAME;
    const prefix = `https://storage.googleapis.com/${bucketName}/`;
    if (!publicUrl.startsWith(prefix)) {
      throw new Error(`URL does not belong to bucket: ${publicUrl}`);
    }
    const filePath = publicUrl.slice(prefix.length);
    log(`Deleting menu image from GCS: ${filePath}`);
    await bucket.file(filePath).delete();
    log(`Deleted menu image: ${filePath}`);
  } catch (error) {
    console.error(`Error deleting menu image from GCS:`, error);
    throw error;
  }
};
