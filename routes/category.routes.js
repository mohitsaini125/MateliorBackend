import express from "express"
import { authMiddleware, isAdmin } from "../middleware/auth.middleware.js"
import { addCategory, deleteCategory, editCategory, getCategories, getCategoryById } from "../controllers/category.controller.js"

const router = express.Router()

router.post("/", authMiddleware, isAdmin, addCategory)
router.patch("/:id", authMiddleware, isAdmin, editCategory)
router.delete("/:id", authMiddleware, isAdmin, deleteCategory)
router.get("/", getCategories)
router.get("/:id", getCategoryById)

export default router;