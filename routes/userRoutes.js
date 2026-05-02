import express from "express";
import {
  verifyApiToken, createUserWithRole, createUserWithRoleByAdmin,
  verifyAdmin, updateUserRole, getAllUsers, verifyAuthToken, updateSecurityKey
} from "../middleware/authMiddleware.js";

const router = express.Router();

// POST /api/auth/set-role (Protected Route)
////router.delete('/delete-user/:id', verifyToken, requireRole('admin'), deleteUserController);
router.post('/create-user', verifyAuthToken, createUserWithRole);

// Route: PUT /api/admin/update-role
router.post('/createbyadmin', verifyApiToken, verifyAdmin, createUserWithRoleByAdmin);
// Protected by TWO middlewares: verifyToken (is logged in) AND verifyAdmin (is admin)
router.put('/update-role', verifyApiToken, verifyAdmin, updateUserRole);
//{
//	"targetUserId": "ddfSKhjKKLJKJKjksdjks",
//	"newRole": "restaurant_owner"
//}
//Update sec key for restaurant owner
router.put('/update-security-key', verifyApiToken, verifyAdmin, updateSecurityKey);

router.get('/users', verifyAuthToken, verifyAdmin, getAllUsers);

export default router;