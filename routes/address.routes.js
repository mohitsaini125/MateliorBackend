import express from "express"
import { authMiddleware } from "../middleware/auth.middleware.js"
import { addAddress, deleteAddress, getAddressById, getAddresses, setAddressDefault, updateAddress } from "../controllers/address.controller.js"

const router = express.Router()

router.post("/", authMiddleware, addAddress)
router.get("/", authMiddleware, getAddresses)
router.get("/:id", authMiddleware, getAddressById)
router.patch("/:id", authMiddleware, updateAddress)
router.patch("/:id/default", authMiddleware, setAddressDefault)
router.delete("/:id", authMiddleware, deleteAddress)


export default router