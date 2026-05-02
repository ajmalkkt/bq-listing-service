// helpers/offerSearchHelper.js
import Offer from "../models/Offer.js";
import pluralize from "pluralize";
import { getCache, setCache } from "./cacheHelper.js";


/**
 * Safely parses the IRREGULARS JSON from .env
 * and returns a key-value map of irregular plural/singular words.
 */
export function getIrregulars() {
  try {
    const irregularsEnv = process.env.IRREGULARS;
    if (!irregularsEnv) {
      console.warn("⚠️ No IRREGULARS defined in .env — using empty map");
      return {};
    }

    const parsed = JSON.parse(irregularsEnv);
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn("⚠️ IRREGULARS in .env is not a valid object — ignoring");
      return {};
    }
    //console.log("✅ Loaded IRREGULARS from .env:", parsed);
    return parsed;
  } catch (err) {
    console.error("❌ Failed to parse IRREGULARS from .env:", err);
    return {};
  }
}

// Initialize once for reuse
const irregulars = getIrregulars();


/**
 * Normalize price safely (handles string or number)
 */
const parsePrice = (v) => {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(/,/g, "");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
};

/**
 * Build regex for word variations (singular/plural/irregular forms)
 */
const buildRegexVariants = (word) => {
  const variants = new Set();

  const lower = word.toLowerCase();
  const singular = pluralize.singular(lower);
  const plural = pluralize.plural(lower);

  variants.add(lower);
  variants.add(singular);
  variants.add(plural);


  Object.entries(irregulars).forEach(([sing, plur]) => {
    if (lower.includes(sing) || lower.includes(plur)) {
      variants.add(sing);
      variants.add(plur);
    }
  });
  console.log(`Regex variants for search key: "${word}" ->`, [...variants]);
  return [...variants].map((v) => new RegExp(`\\b${v}\\b`, "i"));
};

/**
 * Fetch offers by cuisine or category with plural/singular fallback
 */
export const searchOffersByCuisineOrCategory = async (cuisine, baseUrl) => {
  try {
    if (!cuisine || !cuisine.trim()) return [];

    const cacheKey = `offers_${cuisine.toLowerCase()}`;
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      console.log("Returning response for key:", cacheKey);
      return cachedData;//res.status(200).json(cachedData); // ✅ RETURN here
    }

    console.log(`Cache miss for "${cuisine}" — querying DB...`);

    const singleRegexVariants = buildRegexVariants(cuisine);
    const projection = "-image -imageType -__v -_id -active -validFrom -ownerLogin";
    let offers = await Offer.find(
      {
        active: true, // ✅ only active offers
        validTo: { $gte: new Date() }, // ✅ exclude expired offers
        $or: [
          { cuisine: { $in: singleRegexVariants } },
          { category: { $in: singleRegexVariants } },
        ],
      },
      projection
    );

    // 2️⃣ If no results, try multi-word split + singular/plural variants
    if (offers.length === 0) {
      const words = cuisine.split(" ").filter(Boolean);
      const regexVariants = words.flatMap((w) => buildRegexVariants(w));

      offers = await Offer.find(
        {
          active: true, // ✅ only active offers
          validTo: { $gte: new Date() }, // ✅ exclude expired offers
          $or: [
            { cuisine: { $in: regexVariants } },
            { category: { $in: regexVariants } },
          ],
        },
        projection
      );
    }

    // 3️⃣ Final fallback — fuzzy match using loose regex (~contains match)
    if (offers.length === 0) {
      const fuzzy = new RegExp(cuisine.split(" ").join(".*"), "i");
      offers = await Offer.find(
        {
          active: true, // ✅ only active offers
          validTo: { $gte: new Date() }, // ✅ exclude expired offers
          $or: [
            { cuisine: { $regex: fuzzy } },
            { category: { $regex: fuzzy } },
            { title: { $regex: fuzzy } },
            { description: { $regex: fuzzy } },
          ],
        },
        projection
      );
      console.log(`Using fuzzy fallback for "${cuisine}"`);
    }

    if (offers.length === 0) return [];

    // 3️⃣ If still no results, handle array-type cuisines/categories
    // if (offers.length === 0) {
    //   const regexVariants = buildRegexVariants(cuisine);
    //   offers = await Offer.find(
    //     {
    //       $or: [
    //         { cuisine: { $elemMatch: { $in: regexVariants } } },
    //         { category: { $elemMatch: { $in: regexVariants } } },
    //       ],
    //     },
    //     "-image -imageType"
    //   );
    // }

    // 4️⃣ Normalize offers & sort by max discount
    const normalizedOffers = sortResults(offers, baseUrl);
    // 5️⃣ Cache results
    setCache(cacheKey, normalizedOffers, 10800); // Cache for 3 hours
    console.log(`✅ Cached ${normalizedOffers.length} offers for "${cuisine}"`);

    return normalizedOffers;
  } catch (err) {
    console.error("Error in fetchOffersByCuisineOrCategory:", err);
    return [];
  }
};

function sortResults(offers, baseUrl) {
  const normalizedOffers = (offers || []).map((o) => {
    const plain = typeof o.toObject === "function" ? o.toObject() : { ...o };
    const original = parsePrice(plain.originalPrice);
    const discounted = parsePrice(plain.discountedPrice);
    // Determine image URL to display. 
    // If imageType exists, image is saved to DB, so use API endpoint
    // Otherwise, use imageUrl (GCS URL) as is since its saved to cloud 
    const displayImageUrl = plain.imageType
      ? `${baseUrl}/api/offers/${plain.id}/image`
      : plain.imageUrl || null;
    return {
      ...plain,
      discountValue: Math.max(original - discounted, 0),
      imageUrl: displayImageUrl,
    };
  });

  //return sortOffers(normalizedOffers);
  return normalizedOffers;
}
export default sortResults;

export const sortOffers = function (normalizedOffers) {
  const sortFlag = process.env.SORT_FLAG || "SHUFFLE";
  if (sortFlag === "PRICE") {
    // Sort by discount value descending
    normalizedOffers.sort(
      (a, b) => (b.discountValue || 0) - (a.discountValue || 0)
    );
  } else {
    // Randomly select a strategy (Shuffle, Latest, Oldest)
    const strategies = ["SHUFFLE", "LATEST", "OLDEST"];
    const randomStrategy = strategies[Math.floor(Math.random() * strategies.length)];
    //const randomStrategy = "SHUFFLE"; // Default to Shuffle for now per common random behavior

    console.log(`Sorting using strategy: ${randomStrategy}`);

    if (randomStrategy === "LATEST") {
      normalizedOffers.sort((a, b) => (b.id || 0) - (a.id || 0));
    } else if (randomStrategy === "OLDEST") {
      normalizedOffers.sort((a, b) => (a.id || 0) - (b.id || 0));
    } else {
      // SHUFFLE
      for (let i = normalizedOffers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [normalizedOffers[i], normalizedOffers[j]] = [normalizedOffers[j], normalizedOffers[i]];
      }
    }
  }
  return normalizedOffers;
}