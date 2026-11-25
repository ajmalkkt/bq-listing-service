import express from "express";
import { getEvents, getNews, getStocks } from "../controllers/qatarFeedsController.js";

const router = express.Router();

router.get("/stocks", getStocks);
router.get("/news", getNews);
router.get("/events", getEvents);

export default router;
