import Review from "../models/review.models.js";
import Product from "../models/product.models.js";
import Order from "../models/order.model.js";

import {
    successResponse,
    failedResponse,
    errorResponse
} from "../utils/response.js";

export const createReview = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId, rating, review } = req.body;

        if (!productId || rating === undefined) {
            return failedResponse(res, 400,"Product ID and rating are required");
        }

        if (typeof rating !== "number" || rating < 1 || rating > 5) {
            return failedResponse(res, 400, "Rating must be between 1 and 5");
        }

        const product = await Product.findOne({_id: productId,status: "active"});
        if (!product) return failedResponse(res, 404, "Product not found");

        const existingReview = await Review.findOne({user: userId,product: productId});
        if (existingReview) return failedResponse(res, 400, "You have already reviewed this product");

        const deliveredOrder = await Order.findOne({user: userId,orderStatus: "delivered","orderItems.product": productId});
        if (!deliveredOrder) return failedResponse(res, 403,"You can review a product only after purchasing it");

        const newReview = await Review.create({user: userId,product: productId,rating,review});

        return successResponse(res, 201,"Review created successfully",newReview);
    } catch (error) {
        console.error("createReview:", error);
        return errorResponse(res, 500,"Failed to create review");
    }
};

export const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;

        const product = await Product.findById(productId);

        if (!product) return failedResponse(res, 404, "Product not found");

        const reviews = await Review.find({product: productId}).populate({ path: "user", select: "name" }).sort({createdAt: -1});

        return successResponse(res, 200,"Reviews fetched successfully", reviews);

    } catch (error) {
        console.error("getProductReviews:", error);
        return errorResponse(res, 500,"Failed to fetch reviews");
    }
};

export const getMyReviews = async (req, res) => {
    try {
        const userId = req.user._id;
        const reviews = await Review.find({user: userId}).populate({ path: "product", select: "name images price" }).sort({createdAt: -1});
        return successResponse(res, 200,"Your reviews fetched successfully", reviews);
    } catch (error) {
        console.error("getMyReviews:", error);
        return errorResponse(res, 500,"Failed to fetch your reviews");
    }
};

export const updateReview = async (req, res) => {
    try {
        const userId = req.user._id;
        const { reviewId } = req.params;
        const { rating, review } = req.body;

        const existingReview = await Review.findOne({ _id: reviewId, user: userId });

        if (!existingReview) return failedResponse(res, 404,"Review not found");

        if (rating) {
            if (typeof rating !== "number" || rating < 1 || rating > 5) return failedResponse(res, 400, "Rating must be between 1 and 5");
            existingReview.rating = rating;
        }

        if (review) existingReview.review = review;
        await existingReview.save();

        return successResponse(res, 200,"Review updated successfully", existingReview);

    } catch (error) {
        console.error("updateReview:", error);
        return errorResponse(res, 500,"Failed to update review");
    }
};

export const deleteReview = async (req, res) => {
    try {
        const userId = req.user._id;
        const { reviewId } = req.params;
        const review = await Review.findOneAndDelete({_id: reviewId,user: userId});
        if (!review) return failedResponse(res, 404,"Review not found");
        return successResponse(res, 200,"Review deleted successfully");
    } catch (error) {
        console.error("deleteReview:", error);
        return errorResponse(res, 500,"Failed to delete review");
    }
};

export const adminDeleteReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const review = await Review.findByIdAndDelete(reviewId);
        if (!review) return failedResponse(res, 404,"Review not found");
        return successResponse(res, 200,"Review deleted successfully");
    } catch (error) {
        console.error("adminDeleteReview:",error);
        return errorResponse(res, 500,"Failed to delete review");
    }
};