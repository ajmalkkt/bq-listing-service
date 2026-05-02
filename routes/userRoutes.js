import express from "express";
import {
  verifyApiToken, createUserWithRole, createUserWithRoleByAdmin,
  verifyAdmin, updateUserRole, getAllUsers, verifyAuthToken
} from "../middleware/authMiddleware.js";

const router = express.Router();

// POST /api/auth/set-role (Protected Route)
////router.delete('/delete-user/:id', verifyToken, requireRole('admin'), deleteUserController);
router.post('/create-user', verifyAuthToken, createUserWithRole);

router.post('/createbyadmin', verifyApiToken, verifyAdmin, createUserWithRoleByAdmin);

router.put('/update-role', verifyApiToken, verifyAdmin, updateUserRole);

router.get('/users', verifyAuthToken, verifyAdmin, getAllUsers);

export default router;