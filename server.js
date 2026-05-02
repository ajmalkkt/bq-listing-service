import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB, setUpChangesStream } from "./config/db.js";
import Offer from "./models/Offer.js";

import restaurantRoutes from "./routes/restaurantRoutes.js";
import offerRoutes from "./routes/offerRoutes.js";
import bulkRoutes from "./routes/bulkRoutes.js";
import enquiryRoutes from "./routes/enquiryRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import listingRoutes from "./routes/listingRoutes.js";
import Listing from "./models/Listing.js";
import Vertical from "./models/Vertical.js";
import { clearAllCache, deleteCache } from "./utils/cacheHelper.js";
import { set } from "mongoose";
import Restaurant from "./models/Restaurant.js";

//import all env variables
dotenv.config();
//connect to database
connectDB();

//Call setUpChangesStream for models as needed
// Example: setUpChangesStream(Restaurant, (change) => { /* handle change */ });
setUpChangesStream(Offer, "Offer", (change) => { clearAllCache(); }); // Clear cache on Offer changes
//setup change stream for Restaurant  to deleteCache
setUpChangesStream(Restaurant, "Restaurant", (change) => { deleteCache("allRestaurants"); });
setUpChangesStream(Listing, "Listing", (change) => { clearAllCache(); });
setUpChangesStream(Vertical, "Vertical", (change) => { clearAllCache(); });
//initialize express app
const app = express();

// Allow only your frontend origin
const allowedOrigins = [
  "https://dine-deals-dot-browseqatar.el.r.appspot.com", // frontend test App 
  "https://browseqatar.com",
  "https://www.browseqatar.com", 
  "www.browseqatar.com",// main website
  "http://localhost:8081", // Optional: for local development
  "http://127.0.0.1:3000","http://localhost:5173", // Optional: for local development
  "http://127.0.0.1:5173",
  "null", // For local HTML file opened via file:// (origin 'null')
];
//app.use(cors({ origin: "*" }));  // For testing purposes only
const corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      // Check if the origin is not in the allowed list
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = `CORS policy: Access from origin ${origin} not allowed`;
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-api-token",
      "X-Requested-With",
      "Accept"    
    ],
    optionsSuccessStatus: 204, // for legacy browsers
};
app.use(cors(corsOptions));
// Handle preflight requests for all routes
app.options("*", cors(corsOptions));

// ✅ Tell Express to trust GCP/Cloud proxy IPs
app.set("trust proxy", 1); // Why 1?  - “Trust the first proxy hop” —
//  which is correct for GCP and most setups  app/cloud run behind a single proxy/load balancer

app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Middleware and route setups: server.js-> xxxRoutes.js -> controllers/xxxController.js -> middleware/xxxMiddleware.js
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/bulk", bulkRoutes);
app.use("/api/enquiry", enquiryRoutes);
app.use("/api/auth", userRoutes);
app.use("/api/listings", listingRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


// Start bulk upload processor to run every 24 hours
//setInterval(() => {
  //processBulkUploads();
//}, 3600000 * 24); // every 24 hrs
