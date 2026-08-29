import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
            unique: true,
            index: true
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        amount: {
            type: Number,
            required: true,
            min: 0
        },

        method: {
            type: String,
            enum: ["cod", "razorpay"],
            required: true
        },

        status: {
            type: String,
            enum: [
                "pending",
                "processing",
                "paid",
                "failed",
                "refunded",
            ],
            default: "pending"
        },

        razorpayOrderId: {
            type: String,
            unique: true,
            sparse: true
        },

        razorpayPaymentId: {
            type: String,
            unique: true,
            sparse: true
        },

        razorpaySignature: {
            type: String
        },

        refundId: {
            type: String
        },

        refundAmount: {
            type: Number,
            default: 0
        },

        paidAt: {
            type: Date
        },

        refundedAt: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;