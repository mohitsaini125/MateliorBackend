import crypto from "crypto";
import Razorpay from "razorpay";

import Payment from "../models/payment.model.js";
import Order from "../models/order.model.js";

import {
    successResponse,
    failedResponse,
    errorResponse
} from "../utils/response.js";

const getRazorpay = () => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error("Razorpay keys are not configured");
    }
    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
};

/**
 * Create / initialize a Razorpay order for a given internal Order.
 */
export const createPayment = async (req, res) => {
    try {
        const userId = req.user._id;
        const { orderId } = req.body;

        if (!orderId) return failedResponse(res, 400, "Order ID is required");

        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order) return failedResponse(res, 404, "Order not found");

        let payment = await Payment.findOne({ order: order._id });
        if (!payment) return failedResponse(res, 404, "Payment not found");
        if (payment.status === "paid") return failedResponse(res, 400, "Payment is already paid");

        if (payment.razorpayOrderId) {
            return successResponse(res, 200, "Payment already initialized", {
                payment,
                razorpayKeyId: process.env.RAZORPAY_KEY_ID
            });
        }

        let razorpayOrder;
        try {
            razorpayOrder = await getRazorpay().orders.create({
                amount: Math.round(order.totalAmount * 100),
                currency: "INR",
                receipt: order.orderNumber,
                notes: {
                    orderId: order._id.toString(),
                    userId: userId.toString()
                }
            });
        } catch (createErr) {
            console.error("createPayment: Razorpay order creation failed:", createErr.message);
            return failedResponse(res, 502, "Unable to initialize payment. Please try again.");
        }

        payment.razorpayOrderId = razorpayOrder.id;
        payment.amount = order.totalAmount;
        payment.status = "pending";
        payment.method = "razorpay";
        await payment.save();

        return successResponse(res, 201, "Payment initialized successfully", {
            paymentId: payment._id,
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error("createPayment:", error);
        return errorResponse(res, error);
    }
};

/**
 * Verify a completed Razorpay payment (called by client after Checkout,
 * and/or duplicated by a webhook handler for reliability).
 */
export const verifyPayment = async (req, res) => {
    try {
        const userId = req.user._id;
        const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

        if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
            return failedResponse(res, 400, "Payment verification details are required");
        }

        const payment = await Payment.findOne({ razorpayOrderId });
        if (!payment) return failedResponse(res, 404, "Payment record not found");

        if (payment.user.toString() !== userId.toString()) {
            return failedResponse(res, 403, "You are not authorized to verify this payment");
        }

        if (payment.status === "paid") {
            return successResponse(res, 200, "Payment already verified", payment);
        }

        /*
         * Signature verification.
         * Always derive the signature using the Razorpay Order ID stored in
         * our DB (not the one supplied by the client) so the client can't
         * point verification at a different order.
         *
         * NOTE: there is no bypass string here on purpose. If you need a
         * local/dev shortcut, generate a real signature via crypto.createHmac
         * as shown in the project README rather than special-casing a
         * constant — a hardcoded bypass string is a standing vulnerability
         * even if it's only "meant" for dev.
         */
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${payment.razorpayOrderId}|${razorpayPaymentId}`)
            .digest("hex");

        const providedBuf = Buffer.from(razorpaySignature);
        const generatedBuf = Buffer.from(generatedSignature);

        const isValid =
            providedBuf.length === generatedBuf.length &&
            crypto.timingSafeEqual(providedBuf, generatedBuf);

        if (!isValid) return failedResponse(res, 400, "Invalid payment signature");

        /*
         * Cross-check against Razorpay directly. This must fail CLOSED:
         * if we can't reach Razorpay to confirm the payment, we do not mark
         * it paid on signature alone. A valid signature only proves the
         * payload wasn't tampered with — it doesn't prove the payment was
         * actually captured.
         */
        let razorpayPayment;
        try {
            razorpayPayment = await getRazorpay().payments.fetch(razorpayPaymentId);
        } catch (fetchErr) {
            console.error("verifyPayment: Razorpay fetch failed:", fetchErr.message);
            return failedResponse(res, 502, "Unable to confirm payment status with Razorpay. Please retry.");
        }

        if (razorpayPayment.status !== "captured") {
            payment.status = "failed";
            payment.razorpayPaymentId = razorpayPaymentId;
            payment.razorpaySignature = razorpaySignature;
            await payment.save();

            return failedResponse(res, 400, `Payment is not captured. Current status: ${razorpayPayment.status}`);
        }

        if (razorpayPayment.amount !== Math.round(payment.amount * 100)) {
            return failedResponse(res, 400, "Payment amount mismatch");
        }

        const order = await Order.findById(payment.order);
        if (!order) return failedResponse(res, 404, "Associated order not found");

        payment.razorpayPaymentId = razorpayPaymentId;
        payment.razorpaySignature = razorpaySignature;
        payment.status = "paid";
        payment.paidAt = new Date();
        await payment.save();

        order.payment = order.payment || {};
        order.payment.paymentStatus = "paid";
        order.payment.transactionId = razorpayPaymentId;
        order.payment.paymentGateway = "razorpay";
        order.payment.paidAt = new Date();

        // Only move order forward if it hasn't already progressed.
        if (order.orderStatus === "pending") {
            order.orderStatus = "confirmed";
            order.confirmedAt = new Date();
        }

        await order.save();

        return successResponse(res, 200, "Payment verified successfully", { payment, order });
    } catch (error) {
        console.error("verifyPayment:", error);
        return errorResponse(res, error);
    }
};

export const getPayment = async (req, res) => {
    try {
        const userId = req.user._id;
        const { orderId } = req.params;

        const payment = await Payment.findOne({ order: orderId, user: userId }).populate({
            path: "order",
            select: "orderNumber totalAmount orderStatus payment"
        });

        if (!payment) return failedResponse(res, 404, "Payment not found");

        return successResponse(res, 200, "Payment fetched successfully", payment);
    } catch (error) {
        console.error("getPayment:", error);
        return errorResponse(res, error);
    }
};

/**
 * Refund a paid payment.
 * IMPORTANT: this endpoint must be restricted to admin/staff at the router
 * level (e.g. an isAdmin middleware) — there is no ownership check here by
 * design, since refunds are an operational action, not a user self-service
 * one. Do not expose this route to regular authenticated users.
 */
export const refundPayment = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { amount } = req.body;

        const payment = await Payment.findById(paymentId);
        if (!payment) return failedResponse(res, 404, "Payment not found");

        if (payment.method !== "razorpay") {
            return failedResponse(res, 400, "Only Razorpay payments can be refunded through this endpoint");
        }

        if (payment.status !== "paid") {
            return failedResponse(res, 400, "Only paid payments can be refunded");
        }

        const paymentAmountInPaise = Math.round(payment.amount * 100);
        let refundAmount;

        if (amount !== undefined) {
            if (typeof amount !== "number" || amount <= 0) {
                return failedResponse(res, 400, "Invalid refund amount");
            }
            refundAmount = Math.round(amount * 100);
            if (refundAmount > paymentAmountInPaise) {
                return failedResponse(res, 400, "Refund amount cannot exceed payment amount");
            }
        }

        const refundOptions = {};
        if (refundAmount) refundOptions.amount = refundAmount;

        let refund;
        try {
            refund = await getRazorpay().payments.refund(payment.razorpayPaymentId, refundOptions);
        } catch (refundErr) {
            console.error("refundPayment: Razorpay refund failed:", refundErr.message);
            return failedResponse(res, 502, "Unable to process refund with Razorpay. Please retry.");
        }

        payment.refundId = refund.id;
        payment.refundAmount = (payment.refundAmount || 0) + refund.amount / 100;

        if (payment.refundAmount >= payment.amount) {
            payment.status = "refunded";
            payment.refundedAt = new Date();
        } else {
            payment.status = "partially_refunded";
        }

        await payment.save();

        const order = await Order.findById(payment.order);
        if (order) {
            // Only mark the order as refunded once fully refunded.
            if (payment.status === "refunded") {
                order.payment = order.payment || {};
                order.payment.paymentStatus = "refunded";
                order.orderStatus = "refunded";
                await order.save();
            }
        }

        return successResponse(res, 200, "Refund initiated successfully", { payment, refund });
    } catch (error) {
        console.error("refundPayment:", error);
        return errorResponse(res, error);
    }
};

/**
 * Webhook handler: payment.captured
 * This is the reliable counterpart to verifyPayment — it fires even if the
 * user closes the browser right after paying, so it's what actually
 * guarantees an order gets marked paid.
 */
const handleCapturedPayment = async (paymentEntity) => {
    const payment = await Payment.findOne({ razorpayOrderId: paymentEntity.order_id });
    if (!payment) return;

    // Idempotent: verifyPayment (client path) may have already handled this.
    if (payment.status === "paid") return;

    if (paymentEntity.amount !== Math.round(payment.amount * 100)) {
        console.error(`handleCapturedPayment: amount mismatch for payment ${payment._id}`);
        return;
    }

    payment.razorpayPaymentId = paymentEntity.id;
    payment.status = "paid";
    payment.paidAt = new Date();
    payment.method = "razorpay";
    await payment.save();

    const order = await Order.findById(payment.order);
    if (!order) return;

    order.payment = order.payment || {};
    order.payment.paymentStatus = "paid";
    order.payment.transactionId = paymentEntity.id;
    order.payment.paymentGateway = "razorpay";
    order.payment.paidAt = new Date();

    if (order.orderStatus === "pending") {
        order.orderStatus = "confirmed";
        order.confirmedAt = new Date();
    }

    await order.save();
};

/**
 * Webhook handler: payment.failed
 */
const handleFailedPayment = async (paymentEntity) => {
    const payment = await Payment.findOne({ razorpayOrderId: paymentEntity.order_id });
    if (!payment) return;

    // Never downgrade a payment that's already confirmed paid.
    if (payment.status === "paid") return;

    payment.razorpayPaymentId = paymentEntity.id;
    payment.status = "failed";
    await payment.save();
};

/**
 * Webhook handler: refund.processed
 */
export const handleProcessedRefund = async (refund) => {
    const payment = await Payment.findOne({ razorpayPaymentId: refund.payment_id });
    if (!payment) return;

    // Prevent duplicate webhook processing.
    if (payment.refundId === refund.id) return;

    payment.refundId = refund.id;
    payment.refundAmount = (payment.refundAmount || 0) + refund.amount / 100;

    if (payment.refundAmount >= payment.amount) {
        payment.status = "refunded";
        payment.refundedAt = new Date();
    } else {
        payment.status = "partially_refunded";
    }

    await payment.save();

    const order = await Order.findById(payment.order);
    if (order && payment.status === "refunded") {
        order.payment = order.payment || {};
        order.payment.paymentStatus = "refunded";
        order.orderStatus = "refunded";
        await order.save();
    }
};

/**
 * Webhook handler: refund.failed
 */
export const handleFailedRefund = async (refund) => {
    const payment = await Payment.findOne({ razorpayPaymentId: refund.payment_id });
    if (!payment) return;

    console.error(`Refund failed for payment ${payment._id}`);

    /*
     * Keep the payment as paid because the money has NOT been successfully
     * refunded. The database should reflect actual financial state rather
     * than assuming the refund succeeded.
     */
};

/**
 * Main webhook entry point, mounted in index.js as:
 *   server.post("/payment/webhook", express.raw({ type: "application/json" }), handlePaymentWebhook)
 *
 * Because that route uses express.raw() (not express.json()), req.body here
 * is a raw Buffer, not a parsed object. That's required: the signature is
 * computed over the exact raw bytes Razorpay sent, so verifying against a
 * re-serialized JSON.stringify(parsedBody) would fail (key order, spacing,
 * etc. can differ) and would also let a modified-but-reserializable body slip
 * through in edge cases. Always verify signature against the raw buffer,
 * then parse.
 */
export const handlePaymentWebhook = async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.error("handlePaymentWebhook: RAZORPAY_WEBHOOK_SECRET is not configured");
            return res.status(500).json({ success: false });
        }

        const signature = req.headers["x-razorpay-signature"];
        if (!signature) {
            return res.status(400).json({ success: false, message: "Missing signature" });
        }

        const rawBody = req.body; // Buffer, thanks to express.raw() on this route

        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(rawBody)
            .digest("hex");

        const providedBuf = Buffer.from(signature);
        const expectedBuf = Buffer.from(expectedSignature);

        const isValid =
            providedBuf.length === expectedBuf.length &&
            crypto.timingSafeEqual(providedBuf, expectedBuf);

        if (!isValid) {
            console.error("handlePaymentWebhook: invalid signature");
            return res.status(400).json({ success: false, message: "Invalid signature" });
        }

        let event;
        try {
            event = JSON.parse(rawBody.toString("utf8"));
        } catch (parseErr) {
            console.error("handlePaymentWebhook: failed to parse payload:", parseErr.message);
            return res.status(400).json({ success: false, message: "Invalid payload" });
        }

        switch (event.event) {
            case "payment.captured":
                await handleCapturedPayment(event.payload.payment.entity);
                break;
            case "payment.failed":
                await handleFailedPayment(event.payload.payment.entity);
                break;
            case "refund.processed":
                await handleProcessedRefund(event.payload.refund.entity);
                break;
            case "refund.failed":
                await handleFailedRefund(event.payload.refund.entity);
                break;
            default:
                // Unhandled event types are safe to ignore.
                break;
        }

        // Acknowledge with 200 so Razorpay doesn't retry. Non-2xx responses
        // above are the ones we WANT retried (bad signature aside, which
        // should never self-resolve on retry, so those return 400 not 500).
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("handlePaymentWebhook:", error);
        // 500 signals a transient failure on our end — Razorpay will retry.
        return res.status(500).json({ success: false });
    }
};