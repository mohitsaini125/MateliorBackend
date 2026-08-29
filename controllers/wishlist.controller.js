import Wishlist from "../models/wishlist.model.js";
import Product from "../models/product.models.js";
import { errorResponse, failedResponse, successResponse } from "../utils/response.js";

export const addToWishlist = async (req, res) => {
    try {
        const productId = req.params.productId
        if (!productId) return failedResponse(res, 400, "Product ID is required");
        const productExists = await Product.findById(productId);
        if (!productExists) return failedResponse(res, 404, "Product not found");

        const wishlist = await Wishlist.findOne({ user: req.user._id })
        if (!wishlist) return failedResponse(res, 404, "Wishlist not found");
        const inWishlist = wishlist.products.some(id => id.equals(productId))
        if (inWishlist) return failedResponse(res, 400, "Product already in wishlist");
        const updatedWishlist = await Wishlist.findOneAndUpdate(
            { user: req.user._id },
            { $addToSet: { products: productId } },
            { new: true, upsert: true }
        )
        return successResponse(res, 200, "Product added to wishlist", updatedWishlist);
    } catch (err) {
        console.error("addToWishlist error:", err);
        return errorResponse(res, err);
    }
};

export const readWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const populatedList = await Wishlist.find({ user:userId }).populate(
            {
                path: "products",
                match: { status : "active" },
                select: "name image price description category",
                populate : {
                    path : "category",
                    select : "name"
                }
            }
        )
        return successResponse(res, 200, "Fetched wishlist", populatedList);
    } catch (err) {
        console.error("readWishlist error:", err);
        return errorResponse(res, err);
    }
};

export const removeFromWishlist = async (req, res) => {
    try {
        const productId = req.params?.productId || req.body?.productId;
        const userId = req.user._id;

        if (!productId) {
            return failedResponse(res, 400, "Product ID is required");
        }
        const updatedWishlist = await Wishlist.findOneAndUpdate(
            { user: req.user._id },
            { $pull : { products: productId } },
            { new: true }
        )
        return successResponse(res, 200, "Product removed from wishlist", updatedWishlist)
    } catch (err) {
        console.error("removeFromWishlist error:", err);
        return errorResponse(res, err);
    }
};

export const clearWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        await Wishlist.findOneAndDelete({ user: userId });
        return successResponse(res, 200, "Wishlist cleared successfully", []);
    } catch (err) {
        console.error("clearWishlist error:", err);
        return errorResponse(res, err);
    }
};