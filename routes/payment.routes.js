import express from "express";

import {
    createPayment,
    verifyPayment,
    getPayment,
    refundPayment,
    handlePaymentWebhook
} from "../controllers/payment.controller.js";

import { authMiddleware, isAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post(
    "/",
    authMiddleware,
    createPayment
);

router.post(
    "/session",
    authMiddleware,
    createPayment
);

router.post(
    "/verify",
    authMiddleware,
    verifyPayment
);

router.get(
    "/:orderId",
    authMiddleware,
    getPayment
);

router.post(
    "/:paymentId/refund",
    authMiddleware,
    isAdmin,
    refundPayment
);

export default router;