import express from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
    addToWishlist,
    clearWishlist,
    readWishlist,
    removeFromWishlist,
} from "../controllers/wishlist.controller.js";

const router = express.Router();

router.post("/:productId", authMiddleware, addToWishlist);
router.get("/", authMiddleware, readWishlist);
router.delete("/:productId", authMiddleware, removeFromWishlist);
router.delete("/", authMiddleware, clearWishlist);

export default router;