import mongoose from "mongoose";
import crypto from "crypto";
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
    const defaultVerticals = [
      {
        id: "vehicles",
        name: "Vehicles Buy & Sell",
        enabled: true,
        description: "Buy and sell vehicles with verified dealers",
        icon: "Car",
        color: "#1E3A8A",
        route: "/vehicles",
        providerTypes: ["Dealer", "Individual Seller", "Company"],
        additionalAttributes: [
          { name: "make", label: "Make", type: "text", required: false },
          { name: "year", label: "Year", type: "number", required: false },
          { name: "color", label: "Color", type: "text", required: false },
          { name: "mileage", label: "Mileage (km)", type: "number", required: false },
          { name: "transmission", label: "Transmission", type: "select", options: ["Automatic", "Manual"], required: false }
        ]
      },
      {
        id: "accommodations",
        name: "Accommodation",
        enabled: true,
        description: "Find perfect accommodation for your stay",
        icon: "Home",
        color: "#059669",
        route: "/accommodations",
        providerTypes: ["Landlord", "Broker", "Property Manager"],
        additionalAttributes: [
          { name: "bedrooms", label: "Bedrooms", type: "number", required: false },
          { name: "bathrooms", label: "Bathrooms", type: "number", required: false },
          { name: "type", label: "Property Type", type: "select", options: ["Apartment", "Villa", "House", "Room"], required: false },
          { name: "furnishing", label: "Furnishing", type: "select", options: ["Furnished", "Unfurnished", "Semi-Furnished"], required: false }
        ]
      },
      {
        id: "services",
        name: "Services",
        enabled: true,
        description: "Find professional services near you",
        icon: "Wrench",
        color: "#D97706",
        route: "/services",
        providerTypes: ["Individual Provider", "Company", "Agency"],
        additionalAttributes: [
          { name: "experience", label: "Experience", type: "text", required: false },
          { name: "serviceType", label: "Service Type", type: "text", required: false }
        ]
      },
      {
        id: "classifieds",
        name: "Classifieds Buy & Sell",
        enabled: true,
        description: "Buy and sell items in your neighborhood",
        icon: "Package",
        color: "#7C3AED",
        route: "/classifieds",
        providerTypes: ["Individual Seller", "Store"],
        additionalAttributes: [
          { name: "condition", label: "Condition", type: "select", options: ["New", "Like New", "Good", "Fair"], required: false },
          { name: "brand", label: "Brand", type: "text", required: false }
        ]
      },
      {
        id: "jobs",
        name: "Job Listing",
        enabled: true,
        description: "Explore job opportunities in your field",
        icon: "Briefcase",
        color: "#DC2626",
        route: "/jobs",
        providerTypes: ["Employer", "Recruitment Agency"],
        additionalAttributes: [
          { name: "jobType", label: "Job Type", type: "select", options: ["Full-time", "Part-time", "Contract", "Freelance"], required: false },
          { name: "experienceLevel", label: "Experience Level", type: "select", options: ["Entry", "Mid", "Senior", "Executive"], required: false }
        ]
      }
    ];

    for (const vData of defaultVerticals) {
      const existing = await Vertical.findOne({ id: vData.id });
      if (!existing) {
        const vertical = new Vertical(vData);
        await vertical.save();
        console.log(`Seeded vertical: ${vData.id}`);
      } else {
        existing.additionalAttributes = vData.additionalAttributes;
        existing.providerTypes = vData.providerTypes;
        existing.name = vData.name;
        existing.enabled = vData.enabled;
        existing.description = vData.description;
        existing.icon = vData.icon;
        existing.color = vData.color;
        existing.route = vData.route;
        await existing.save();
        console.log(`Updated vertical additionalAttributes: ${vData.id}`);
      }
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
