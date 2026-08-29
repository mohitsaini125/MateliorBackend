import User from "../models/user.models.js"
import jwt from "jsonwebtoken"
import { errorResponse, failedResponse } from "../utils/response.js"
export const authMiddleware = async (req, res, next) => {
    try {
    let token = req.headers.authorization;
    if (!token) return failedResponse(res, 401, "Access token not found")

    if (token.startsWith("Bearer ")) token = token.slice(7).trim()

    let tokenData;
    try {
        tokenData = jwt.verify(token, process.env.jwtSecret);
    } catch (err) {
        return failedResponse(res, 401, "Access token not valid");
    }

    if (!tokenData || !tokenData.id) return failedResponse(res, 400, "Access token not valid")

    const user = await User.findById(tokenData.id);
    if (!user) return failedResponse(res, 404, "User not found")

    req.user = user;
    next();
    } catch (err) {
        console.log("Auth middleware error:",err)
        return errorResponse(res, 500, "Internal server error")
    }
};

export const isAdmin = async (req, res, next) => {
    if (!(req.user.role === 'admin' || req.user.role === 'superadmin')) return res.status(403).json({success: false,message: "Access denied, admins and superadmins only"});
    else next()
};

export const isSuperAdmin = async (req, res,next)=>{
    if(req.user.role !== 'superadmin') return failedResponse(res,403,"Access denied, superadmins only")
    else next()
}