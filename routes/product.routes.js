import express from "express"
import { authMiddleware, isAdmin } from "../middleware/auth.middleware.js";
import { addProduct, deleteProduct, editProduct, getProductById, getProducts } from "../controllers/product.controller.js";

const router = express.Router();

router.post("/", authMiddleware, isAdmin, addProduct)
router.patch("/:id", authMiddleware, isAdmin, editProduct)
router.delete("/:id", authMiddleware, isAdmin,deleteProduct)
router.get("/", getProducts)
router.get("/:id", getProductById)

export default router;