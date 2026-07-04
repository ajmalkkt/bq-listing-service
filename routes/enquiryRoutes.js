import express from "express";
import { bulkRateLimiter } from "../middleware/rateLimiter.js";
import { sendEnquiryEmail, getEnquiries, sendAccountCreationEmail, 
    getEnquiriesByPage, updateEnquiryStatus, sendListingAdEnquiryEmail } from "../controllers/enquiryController.js"; 
import { verifyApiToken, verifyAuthToken, verifyAdmin, decodeAuthToken } from "../middleware/authMiddleware.js";   

const router = express.Router();

// Send enquiry email
router.post("/", bulkRateLimiter, decodeAuthToken, sendEnquiryEmail);
router.post("/listing", bulkRateLimiter, decodeAuthToken, sendListingAdEnquiryEmail);
// Additional route to get all enquiries (for admin use)
router.get("/", verifyApiToken, verifyAdmin, getEnquiries);
router.get("/paginated", verifyAuthToken, getEnquiriesByPage);
router.patch("/status/:id",  verifyAuthToken, verifyAdmin, updateEnquiryStatus);
router.post("/account-creation/:id", verifyAuthToken, verifyAdmin, sendAccountCreationEmail);
export default router;
