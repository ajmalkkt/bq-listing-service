//import admin  from "../config/firebaseAdmin.js";
import { admin, db } from "../config/firebaseAdmin.js";

export const verifyAuthToken = async (req, res, next) => {
  //bearer token from Authorization header
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  //bearer token validation
  try {
    //console.log("Bearer Token:"+ token);
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; // Contains uid, email, and custom claims (roles)

    next();
  } catch (error) {
    return res.status(403).json({ message: "Unauthorized", error: error.message });
  }
};

export const decodeAuthToken = async (req, res, next) => {
  //bearer token from Authorization header
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    //bearer token
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken; // Contains uid, email, and custom claims (roles)
    } catch (error) {
      console.warn("Error decoding auth token; proceed as Guest:", error);
    }
  }
  next();
};

export const verifyApiToken = async (req, res, next) => {
  //api-token from custom header
  const providedToken = req.headers["x-api-token"];
  //bearer token from Authorization header
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ message: "No token provided" });

  if (!providedToken) {
    return res.status(401).json({ message: "Missing API Key" });
  }
  //const validToken = process.env.PROTECTED_API_TOKEN; // common token for all
  //api token validation
  //if (providedToken !== validToken) {
  //  return res.status(403).json({ message: "Invalid API token." });
  //} 

  //bearer token validation
  try {
    //console.log("Bearer Token:"+ token);
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; // Contains uid, email, and custom claims (roles)
    // DEBUG LOG: Check if role is present
    //console.log("User Role and Email:", req.user.role, req.user.email);

    // Fetch the user's profile from Firestore to check their security key
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const userData = userDoc.data();
    const validToken = userData.securityKey;
    //console.log("Valid API Token from user profile: ", validToken);
    //api token validation - return error if invalid
    if (providedToken !== validToken) {
      return res.status(403).json({ message: "Invalid API Key." });
    }
    //proceed to the route after validation
    next();
  } catch (error) {
    console.error("Error verifying API token:", error.message);
    return res.status(403).json({ message: "Unauthorized", error: "Your are not authorized to access this resource" });
  }
};

export const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role && req.user.role !== 'admin') { // Admin always has access
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
};

//write async functaion to create user with custom role
// THis is for new user creation with role assignment by public or restaurant owner
export const createUserWithRole = async (req, res) => {
  try {
    // 1. Get data sent from frontend
    const { name, username, role } = req.body;
    //console.log("Creating user:", name, username, role);
    // 2. Get secure data from the verified token
    const { uid, email } = req.user;
    console.log("User UID, email:", uid, email);
    //Only allow specific roles, not admin
    const validRoles = ['restaurant_owner', 'user'];
    if (!validRoles.includes(role)) return res.status(500).send("Invalid role", role);

    // 3. Define the user document
    const userBuffer = {
      name,
      username,
      email: email, // Prefer email from token as it is verified
      role: role || 'user', // Default to 'user' if role is missing
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // 4. Save to Firestore
    // Using .doc(uid) creates the document with the Firebase Auth UID as the key.
    // This makes it very easy to find the user later.
    //const db = admin.firestore();
    await db.collection('users').doc(uid).set(userBuffer);

    // Optional: Set Custom Claims on Firebase Auth user for 
    // easier frontend role checking
    // Firebase Auth stores the role in the user's auth token
    await admin.auth().setCustomUserClaims(uid, { role: userBuffer.role });

    res.status(201).json({ message: 'User profile created successfully', user: userBuffer });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 2. Verify Admin Role Middleware
export const verifyAdmin = async (req, res, next) => {
  try {
    const requesterUid = req.user.uid;
    //const db = admin.firestore();
    // Fetch the user's profile from Firestore to check their role
    const userDoc = await db.collection('users').doc(requesterUid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Requester profile not found' });
    }

    const userData = userDoc.data();

    // CHECK: Is the role 'admin'?
    if (userData.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied.Please contact support.' });
    }

    next(); // Proceed to the route
  } catch (error) {
    console.error("Error verifying admin status:", error.message);
    res.status(500).json({ message: 'Error verifying admin status', error: "Your are not authorized to access this resource" });
  }
};

//create user by admin with any role
export const createUserWithRoleByAdmin = async (req, res) => {
  try {
    // 1. Get data sent by admin from frontend
    //uid of new user to be created in DB
    const { uid, name, username, email, role } = req.body;
    //console.log("Creating user:", name, username, role);
    console.log("User UID, email, role:", uid, email, role);
    //Only allow specific roles to created
    const validRoles = ['restaurant_owner', 'user'];
    if (!validRoles.includes(role)) return res.status(400).send("Invalid role", role);

    // 3. Define the user document
    const userBuffer = {
      name,
      username,
      email: email, // Prefer email from token as it is verified
      role: role || 'user', // Default to 'user' if role is missing
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // 4. Save to Firestore
    // Using .doc(uid) creates the document with the Firebase Auth UID as the key.
    // This makes it very easy to find the user later.
    await db.collection('users').doc(uid).set(userBuffer);
    // Optional: Set Custom Claims on Firebase Auth user for 
    // easier frontend role checking
    // Firebase Auth stores the role in the user's auth token
    await admin.auth().setCustomUserClaims(uid, { role: userBuffer.role });

    res.status(201).json({ message: 'User profile created successfully', user: userBuffer });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

//update role req: {122343, 'restaurant_owner' }
export const updateUserRole = async (req, res) => {
  try {
    const { targetUserId, newRole } = req.body;

    if (!targetUserId || !newRole) {
      return res.status(400).json({ message: 'targetUserId and newRole are required' });
    }

    const validRoles = ['restaurant_owner', 'user'];
    if (!validRoles.includes(newRole)) return res.status(400).send("Invalid role/cannot take admin role", role);


    // 1. Update the Role in Firestore (Database)
    //const db = admin.firestore();
    await db.collection('users').doc(targetUserId).update({
      role: newRole,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 2. Update Firebase Auth Custom Claims (Authentication)
    // This allows you to enforce security rules like: request.auth.token.role == 'admin'
    await admin.auth().setCustomUserClaims(targetUserId, { role: newRole });

    res.status(200).json({
      message: `User ${targetUserId} updated to role: ${newRole}`
    });

  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};
//Update users collection with securityKey attribute
// This key is used for restaurant owner to manage offers
export const updateSecurityKey = async (req, res) => {
  try {
    const { targetUserId, securityKey } = req.body;

    if (!targetUserId || !securityKey) {
      return res.status(400).json({ message: 'targetUserId and securityKey are required' });
    }

    // 1. Update the securityKey in Firestore (Database)
    //const db = admin.firestore();
    await db.collection('users').doc(targetUserId).update({
      securityKey: securityKey,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      message: `User ${targetUserId} updated with securityKey: ${securityKey}`
    });

  } catch (error) {
    console.error('Error updating securityKey:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

// get list of all users (for admin use)
export const getAllUsers = async (req, res) => {
  try {
    //const db = admin.firestore();
    const usersSnapshot = await db.collection('users').get();
    const users = [];
    usersSnapshot.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};   
