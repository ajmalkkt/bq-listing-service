import mongoose from "mongoose";
import crypto from "crypto";
import { readFile } from "node:fs/promises";
import Vertical from "../models/Vertical.js";

const algorithm = "aes-256-cbc";

const decryptPassword = (encryptedPassword, ivHex, secretKey) => {
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), iv);
  let decrypted = decipher.update(encryptedPassword, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};

const seedVerticals = async () => {
  try {
    const defaultVerticals = JSON.parse(await readFile(new URL("../scripts/verticals.json", import.meta.url), "utf8"));

    for (const vData of defaultVerticals) {
      await Vertical.findOneAndUpdate(
        { id: vData.id },
        { $set: vData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`Seeded/updated vertical metadata: ${vData.id}`);
    }
  } catch (error) {
    console.error("Error seeding verticals:", error.message);
  }
};

const connectDB = async () => {
  try {
    const decryptedPass = decryptPassword(
      process.env.MONGO_PASS_ENC,
      process.env.MONGO_IV,
      process.env.MONGO_SECRET_KEY
    );

    const mongoURI = `mongodb+srv://${process.env.MONGO_USER}:${encodeURIComponent(
      decryptedPass
    )}@${process.env.MONGO_CLUSTER}/${process.env.MONGO_DB}?retryWrites=true&w=majority`;

    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    //await seedVerticals();
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};

/** Generic change event listener from mongo 
 * model - to be used for real-time updates or logging (Restaurant, Offer, Enquiry etc.)
 * onChange - callback function to handle the change event
 */
const setUpChangesStream = (model, name, onChange) => {

  //watch for update and delete events
  //For Restaurant model, we need to watch for insert events as well to update the cache
  let pipeline = [
    { 
      $match: { 
        operationType: { $in: ['update', 'delete'] } 
      } 
    }
  ];
  if(name === "Restaurant") {
    pipeline = [
      { 
        $match: { 
          operationType: { $in: ['update', 'delete', 'insert'] } 
        } 
      }
    ];
  }
  const changeStream = model.watch(pipeline);
  //by default update only  gives delta fields changed, to get full document use:
  // const changeStream = model.watch([], { fullDocument: 'updateLookup' });

  changeStream.on("change", (next) => {
    console.log(`${name} document Change event:`, next.operationType);
    
    if (next.operationType === 'delete') {
      console.log("Deleted event ID:", next.documentKey._id);
    } else if (next.operationType === 'update') {
      console.log("Updated Fields:", next.updateDescription.updatedFields);
    } else if (next.operationType === 'insert') {
      console.log("Inserted Event ID:", next.fullDocument._id);
    }

    onChange(next);//call the provided callback with change event
  });

  changeStream.on("error", (error) => {
    console.error("Change Stream Error:", error);
  });

  //return changeStream;
};

export { connectDB, setUpChangesStream };

//export default connectDB;
