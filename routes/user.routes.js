import express from "express";
import {
    getMe,
    login,
    register,
    updateProfile,
} from "../controllers/user.controller.js";
import { authMiddleware, isAdmin, isSuperAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, getMe);
router.patch("/me", authMiddleware, updateProfile);

export default router;