import express from "express"
import upload from "../middleware/upload.middleware.js"
import { uploadImages } from "../controllers/upload.controller.js"
import { authMiddleware, isAdmin } from "../middleware/auth.middleware.js"

const router = express.Router()

router.post("/products", authMiddleware, isAdmin, upload.array("images", 5), uploadImages)

export default router