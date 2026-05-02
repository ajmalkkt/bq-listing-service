import express from "express";
import { bulkRateLimiter } from "../middleware/rateLimiter.js";
import { sendEnquiryEmail, getEnquiries, sendAccountCreationEmail, 
    getEnquiriesByPage, updateEnquiryStatus } from "../controllers/enquiryController.js"; 
import { verifyApiToken, verifyAuthToken, verifyAdmin, decodeAuthToken } from "../middleware/authMiddleware.js";   

const router = express.Router();

// Send enquiry email
router.post("/", bulkRateLimiter, decodeAuthToken, sendEnquiryEmail);
// Additional route to get all enquiries (for admin use)
router.get("/", verifyApiToken, verifyAdmin, getEnquiries);
router.get("/paginated", verifyAuthToken, getEnquiriesByPage);
router.patch("/status/:id", verifyApiToken, verifyAdmin, updateEnquiryStatus);
router.post("/account-creation/:id", verifyAuthToken, verifyAdmin, sendAccountCreationEmail);
export default router;
