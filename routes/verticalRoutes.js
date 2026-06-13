import express from "express";
import { getAllVerticals, createVertical } from "../controllers/verticalController.js";

const router = express.Router();

router.get("/", getAllVerticals);
router.post("/", createVertical);

export default router;
