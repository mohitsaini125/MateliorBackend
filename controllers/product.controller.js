import Product from "../models/product.models.js"
import Category from "../models/category.model.js"
import mongoose from "mongoose"
import { errorResponse, failedResponse, successResponse } from "../utils/response.js"

export const addProduct = async (req, res) => {
    try {
        const { name, category, price, stock, description, discountPercent, sku, images, material, colors, weight, tags, status } = req.body;
        if (!name?.trim().length || !category?.trim().length || !price || !stock) return failedResponse(res, 400, "Required fields are missing")
        const newProduct = await Product.create({
            name: name.trim(),
            category: category.trim(),
            price,
            stock,
            description: description.trim(),
            discountPercent,
            sku,
            images,
            material,
            colors,
            weight,
            tags,
            status,
        });
        return successResponse(res, 201, "New product has been added", newProduct);
    } catch (err) {
        console.error("addProduct error:", err);
        return errorResponse(res, err);
    }
};

export const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const body = req.body;
        const updatedProduct = await Product.findByIdAndUpdate(id, body, { new: true });
        if (!updatedProduct) return failedResponse(res, 404, "product does not exist");
        return successResponse(res, 200, "product updated", updatedProduct);
    } catch (err) {
        console.error("editProduct error:", err);
        return errorResponse(res, err);
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const deletedProduct = await Product.findByIdAndDelete(id);
        if (!deletedProduct) return failedResponse(res, 404, "product does not exist");
        return successResponse(res, 200, "product deleted", deletedProduct);
    } catch (err) {
        console.error("deleteProduct error:", err);
        return errorResponse(res, err);
    }
};

export const getProducts = async (req, res) => {
    try {
        let { sort, order, category, sku, q, material, color, minPrice, maxPrice, page, limit } = req.query;
        page = Math.max(1, parseInt(page, 10) || 1);
        limit = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (page - 1) * limit;

        const sortOptions = {};
        const orderNo = order === 'desc' ? -1 : 1

        if (sort === "price") sortOptions.price = orderNo;
        else if (sort === "category") sortOptions.category = orderNo;
        else if (sort === "newest") sortOptions.createdAt = orderNo;
        else if (sort === "popularity") sortOptions.createdAt = -1;
        else if (sort === "rating") sortOptions.rating = orderNo;
        else sortOptions.createdAt = -1;

        const query = { status: "active" };

        if (q) {
            query.$or = [
                { name: { $regex: q, $options: "i" } },
                { description: { $regex: q, $options: "i" } }
            ];
        }
        if (category) query.category = category;
        if (sku) query.sku = sku;
        if (material) query.material = material;
        if (color) query.colors = { $in: [color] };
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }

        const [products, total] = await Promise.all([
            Product.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(limit)
                .populate("category"),
            Product.countDocuments(query),
        ]);

        const totalPages = Math.ceil(total / limit) || 1;

        return successResponse(res, 200, "products fetched successfully", {
            items: products,
            page,
            limit,
            total,
            totalPages,
        });
    } catch (err) {
        console.error("getProducts error:", err);
        return errorResponse(res, err);
    }
};

export const getProductById = async (req, res) => {
    try {
        const id = req.params.id;
        const product = await Product.findById(id).populate("category");
        if (!product) return failedResponse(res, 404, "product does not exist");
        return successResponse(res, 200, "product fetched", product);
    } catch (err) {
        console.error("getProductById error:", err);
        return errorResponse(res, err);
    }
};

