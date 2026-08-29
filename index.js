import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import userRouter from "./routes/user.routes.js";
import productRouter from "./routes/product.routes.js";
import categoryRouter from "./routes/category.routes.js";
import cartRouter from "./routes/cart.routes.js";
import wishlistRouter from "./routes/wishlist.routes.js";
import addressRouter from "./routes/address.routes.js";
import orderRouter from "./routes/order.routes.js";
import paymentRouter from "./routes/payment.routes.js";
import reviewRouter from "./routes/review.routes.js";
import adminRouter from "./routes/admin.routes.js";

import { handlePaymentWebhook } from "./controllers/payment.controller.js";

const server = express();

server.post(
    "/payment/webhook",
    express.raw({
        type: "application/json"
    }),
    handlePaymentWebhook
);

server.use(express.json())

server.use("/user", userRouter);
server.use("/users", userRouter);

server.use("/product", productRouter);
server.use("/products", productRouter);

server.use("/category", categoryRouter);
server.use("/categories", categoryRouter);

server.use("/cart", cartRouter);
server.use("/wishlist", wishlistRouter);

server.use("/address", addressRouter);
server.use("/addresses", addressRouter);

server.use("/order", orderRouter);
server.use("/orders", orderRouter);

server.use("/payment", paymentRouter);
server.use("/payments", paymentRouter);

server.use("/review", reviewRouter);
server.use("/reviews", reviewRouter);

server.use("/admin", adminRouter);

mongoose.connect(process.env.dbURL)
    .then(() => {
        server.listen(process.env.PORT || 3000, () => {
            console.log(`server listening at ${process.env.PORT}`);
        });
    })
    .catch((err) => {
        console.error("Failed to connect to MongoDB:", err);
    });



