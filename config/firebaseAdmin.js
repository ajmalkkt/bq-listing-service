import admin from "firebase-admin";
import { createRequire } from "module";

// Create a 'require' function to load JSON files in ES Modules
const require = createRequire(import.meta.url);
const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT); // Adjust path

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 2. Initialize Firestore
const db = admin.firestore();

// 3. Point to your named Native database
// THIS IS THE FIX:
db.settings({ 
  databaseId: 'dinedeals' 
});
// 5. Export using ES6 syntax
export { admin, db };