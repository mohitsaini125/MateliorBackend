import express from "express";
import { authMiddleware, isAdmin } from "../middleware/auth.middleware.js";
import {
    cancelOrder,
    createOrder,
    getAllOrdersAdmin,
    getOrderById,
    getOrders,
    returnOrder,
    updateOrderStatus,
    updateRefundStatus,
    updateReturnStatus,
} from "../controllers/order.controller.js";

const router = express.Router();

// Customer APIs
router.post("/", authMiddleware, createOrder);
router.get("/", authMiddleware, getOrders);
router.get("/:orderId", authMiddleware, getOrderById);
router.patch("/:orderId/return", authMiddleware, returnOrder);
router.patch("/:orderId/cancel", authMiddleware, cancelOrder);

// Admin
router.get("/admin", authMiddleware, isAdmin, getAllOrdersAdmin);
router.patch(
    "/admin/:orderId/status",
    authMiddleware,
    isAdmin,
    updateOrderStatus
);
router.patch(
    "/admin/:orderId/return",
    authMiddleware,
    isAdmin,
    updateReturnStatus
);
router.patch(
    "/admin/:orderId/refund",
    authMiddleware,
    isAdmin,
    updateRefundStatus
);

export default router;