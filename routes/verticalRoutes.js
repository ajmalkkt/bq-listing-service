import express from "express";
import { getAllVerticals, createVertical } from "../controllers/verticalController.js";
import { verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getAllVerticals);
router.post("/", verifyAdmin, createVertical);

export default router;
