import express from "express";

import {
    createReview,
    getProductReviews,
    getMyReviews,
    updateReview,
    deleteReview,
    adminDeleteReview
} from "../controllers/review.controller.js";

import { authMiddleware, isAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();


router.post("/",authMiddleware,createReview);

router.get("/product/:productId", getProductReviews);

router.get("/my",authMiddleware,getMyReviews);

router.patch("/:reviewId",authMiddleware,updateReview);

router.delete("/:reviewId",authMiddleware,deleteReview);

router.delete("/admin/:reviewId",authMiddleware,isAdmin,adminDeleteReview
);


export default router;