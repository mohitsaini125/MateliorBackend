import express from "express";

import {
    getDashboard,
    getAllUsers,
    getUserById,
    updateProductStock,
    updateOrderStatus,
    getAllReviews,
    deleteReviewByAdmin,
    updateUserRole,
    getUserActivity
} from "../controllers/admin.controller.js";

import { authMiddleware, isAdmin, isSuperAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware)

//Dashobard
router.get("/dashboard", isAdmin, getDashboard);

//Users
router.get("/users", isAdmin, getAllUsers);
router.get("/users/:userId", isAdmin, getUserById);
router.get("/users/:userId/activity", isAdmin, getUserActivity);
router.patch("/users/:userId/role", isSuperAdmin, updateUserRole);

//Products
router.patch("/products/:productId/stock", isAdmin,updateProductStock);

//Orders
router.patch("/orders/:orderId/status",updateOrderStatus);

//Reviews
router.get("/reviews",getAllReviews);
router.delete("/reviews/:reviewId",deleteReviewByAdmin);

export default router;