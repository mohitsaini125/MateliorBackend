import Category from "../models/category.model.js"
import mongoose from "mongoose"
import { errorResponse, failedResponse, successResponse } from "../utils/response.js"

export const addCategory = async (req, res) => {
    try {
        const { name, image, description } = req.body;
        if (!name || !image || !description) {
            return failedResponse(res, 400, "required fields are missing");
        }
        const newCategory = await Category.create({ name, image, description });
        return successResponse(res, 201, "new category added", newCategory);
    } catch (err) {
        console.error("addCategory error:", err);
        return errorResponse(res, err);
    }
};

export const editCategory = async (req, res) => {
    try {
        const { name, image, description, status } = req.body;
        const id = req.params.id;
        const updatedCategory = await Category.findByIdAndUpdate(id, { name, image, description, status }, { new: true });
        if (!updatedCategory) {
            return failedResponse(res, 404, "category does not exist");
        }
        return successResponse(res, 200, "category updated", updatedCategory);
    } catch (err) {
        console.error("editCategory error:", err);
        return errorResponse(res, err);
    }
};

export const deleteCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const deletedCategory = await Category.findByIdAndDelete(id);
        if (!deletedCategory) {
            return failedResponse(res, 404, "category does not exist");
        }
        return successResponse(res, 200, "category deleted", deletedCategory);
    } catch (err) {
        console.error("deleteCategory error:", err);
        return errorResponse(res, err);
    }
};

export const getCategories = async (req, res) => {
    try {
        const { name, q, status, sort, order } = req.query;
        const query = {};
        const sortOptions = {};
        let sortNumber = 1;
        if (q) query.$or = [{ name: { $regex: q, $options: "i" } }, { description: { $regex: q, $options: "i" } }];
        if (name) query.name = name;
        if (status) query.status = status;
        if (order === "desc") sortNumber = -1;
        if (sort === "name") sortOptions.name = sortNumber;
        else sortOptions.createdAt = -1;

        const categories = await Category.find(query).sort(sortOptions);
        return successResponse(res, 200, "fetched categories", categories);
    } catch (err) {
        console.error("getCategory error:", err);
        return errorResponse(res, err);
    }
};

export const getCategoryById = async (req, res) => {
    try {
        const id = req.params.id;
        const category = await Category.findById(id);
        if (!category) {
            return failedResponse(res, 404, "category not found");
        }
        return successResponse(res, 200, "category found", category);
    } catch (err) {
        console.error("getCategoryById error:", err);
        return errorResponse(res, err);
    }
};