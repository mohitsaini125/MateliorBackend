import { errorResponse, failedResponse } from "../utils/response.js"

export const uploadImages = async (req, res) => {
    try {
        if(!req.files || req.files.length === 0) {
            return failedResponse(res, 400, "No images uploaded")
        }
        const urls = req.files.map((file) => file.path)
        return successResponse(res, 200, "Images uploaded", { urls })
    } catch(err) {
        console.log("uploadImages Error:", err.message)
        return errorResponse(res, err)
    }
}