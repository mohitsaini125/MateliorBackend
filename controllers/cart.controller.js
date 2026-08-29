import Cart from "../models/cart.model.js";
import Product from "../models/product.models.js";
import { errorResponse, failedResponse, successResponse } from "../utils/response.js";

export const addToCart = async (req, res) => {
    try {
        const userId = req.user._id;
        const productId = req.params.productId;
        const quantity = Math.max(1, parseInt(req.body.quantity, 10) || 1);

        if (!productId) return failedResponse(res, 400, "Product ID is required");

        const product = await Product.findById(productId);
        if (!product) return failedResponse(res, 404, "Product does not exist");
        if (product.status === "hidden") return failedResponse(res, 403, "Item is not active");
        if (product.stock === 0) return failedResponse(res, 409, "Item is sold out");

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({ user: userId, items: [] })
        }

        const existingItem = cart.items.find(
            (item) => item.product && item.product.toString() === productId.toString()
        );

        const desiredQuantity = existingItem ? existingItem.quantity + quantity : quantity;
        const finalQuantity = Math.min(desiredQuantity, product.stock);
        const wasClamped = desiredQuantity > product.stock;

        if (existingItem) existingItem.quantity = finalQuantity;
        else cart.items.push({ product: productId, quantity: finalQuantity });

        await cart.save();
        await cart.populate("items.product")
        return successResponse(res, 200, wasClamped ? `Only ${finalQuantity} in stock - quantity adjusted` : "Product added to cart", cart);
    } catch (err) {
        console.error("addToCart error:", err);
        return errorResponse(res, err);
    }
};

export const updateCartQuantity = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.params;
        const quantity = parseInt(req.body.quantity, 10)

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return failedResponse(res, 404, "Cart does not exist");
        }

        const itemIndex = cart.items.findIndex((item)=> item.product.toString() === productId)

        if (quantity <= 0) {
            cart.items.splice(itemIndex, 1)
        } else {
            const item = cart.items[itemIndex]
            const product = await Product.findById(item.product);
            if(!product) {
                return failedResponse(res, 404, "Product does not exist")
            }
            if(quantity > product.stock) {
                item.quantity = product.stock;
            } else {
                item.quantity = quantity;
            }
        }
        await cart.save();
        const updatedCart = await Cart.findById({ user: userId }).populate("items.product");
        return successResponse(res, 200, "Cart updated", updatedCart);
    } catch (err) {
        console.error("updateCartQuantity error:", err);
        return errorResponse(res, err);
    }
};

export const removeFromCart = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.params;

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return failedResponse(res, 404, "Cart does not exist");
        }

        cart.items = cart.items.filter(
            (item) =>
                item.product.toString() !== productId
        );

        await cart.save();
        const updatedCart = await Cart.findById({ user: userId }).populate("items.product");
        return successResponse(res, 200, "Product removed from cart", updatedCart);
    } catch (err) {
        console.error("removeFromCart error:", err);
        return errorResponse(res, err);
    }
};

export const getCart = async (req, res) => {
    try {
        const userId = req.user._id;
        const cart = await Cart.findOne({ user: userId }).populate("items.product");
        if(!cart) return failedResponse(res, 404, "Cart does not exist");
        return successResponse(res, 200, "Cart items fetched", cart);
    } catch (err) {
        console.error("getCart error:", err);
        return errorResponse(res, err);
    }
};

export const clearCart = async (req, res) => {
    try {
        const userId = req.user._id;
        const cart = await Cart.findOne({ user: userId });
        if(!cart) return failedResponse(res, 404, "Cart does not exist");
        cart.items = [];
        await cart.save();
        return successResponse(res, 200, "Cart cleared successfully", cart);
    } catch (err) {
        console.error("clearCart error:", err);
        return errorResponse(res, err);
    }
};

export const deleteCartProduct = removeFromCart;