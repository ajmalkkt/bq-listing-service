import multer from "multer";
import path from "path";
import dotenv from "dotenv";

//Route file uses multer with MemoryStorage/Diskstorage. 
// This keeps the file in req.file.buffer 
// so the save router process can read it from mem/disk buffer
//router.post('/addOffer', upload.single('image'), addOrUpdateOffer);
//fileSize: 200 * 1024, // 200KB limit is set to reduce size

dotenv.config();

const saveToDB = process.env.SAVE_IMAGES_TO_DB === "true";

let storage;

if (saveToDB) {
  // ✅ Store in memory (so you can write buffer to Mongo)
  storage = multer.memoryStorage();
  console.log("Multer using memory storage (SAVE_IMAGES_TO_DB=true)");
} else {
  // ✅ Store on disk (if DB flag is off)
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, process.env.UPLOADS_PATH || "uploads/");
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  });
  console.log("Multer using disk storage (SAVE_IMAGES_TO_DB=false)");
}

const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024, // 200KB limit as you mentioned earlier
  },
});

export default upload;
