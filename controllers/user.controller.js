import jwt from "jsonwebtoken";
import User from "../models/user.models.js";
import bcrypt from "bcrypt";
import { errorResponse, failedResponse, successResponse } from "../utils/response.js";

export const register = async (req, res) => {
    let { name, email, password, phone } = req.body;

    try {
        if (!name.trim().length || !email.trim().length || !password) return failedResponse(res, 400, "invalid data");
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if(!emailRegex.test(email)) return failedResponse(res, 400, "invalid email address")

        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        if(!strongPasswordRegex.test(password)) return failedResponse(res, 400, "password must be at least 8 characters and include uppercase, lowercase, a number and a special character.")

        if(phone) {
            const phoneRegex = /^\d{10}$/;
            if(!phoneRegex.test(phone)) {
                return failedResponse(res, 400, "invalid phone number")
            }
        }

        const user = await User.findOne({ email })

        if (user) return failedResponse(res, 409, "user already exists");

        password = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            name,
            email,
            password,
            phone
        });

        const token = jwt.sign({ id: newUser._id }, process.env.jwtSecret,{ expiresIn : "7d" });
        
        const userObj = newUser.toObject();
        delete userObj.password;

        return successResponse(res, 201, "successfully registered", {
            token,
            user: userObj
        });

    } catch (err) {
        console.error("user registration error:", err)
        return errorResponse(res, err);
    }
};


export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return failedResponse(res, 400, "invalid data");
        }
        const user = await User.findOne({ email }).select("+password")

        if (!user) {
            return failedResponse(res, 404, "User does not exist, please register");
        }

        const isCorrect = await bcrypt.compare(password, user.password);
        if (!isCorrect) {
            return failedResponse(res, 400, "invalid credentials");
        }
        const token = jwt.sign({ id: user._id }, process.env.jwtSecret, { expiresIn: "7d" });
        const userObj = user.toObject();
        delete userObj.password;

        return successResponse(res, 200, "logged in", {
            token,
            user: userObj
        });

    } catch (err) {
        console.error("login error:", err)
        return errorResponse(res, err);
    }
};

export const getMe = async (req, res) => {
    try {
        const userObj = req.user.toObject();
        return successResponse(res, 200, "user profile", userObj);
    } catch (err) {
        console.error("getMe error:", err);
        return errorResponse(res, err);
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { name, phone } = req.body;
        if(name && name.trim().length < 3) return failedResponse(res, 400, "name cannot be less than 3 characters")
        if(name) req.user.name = name.trim();
        
        if(phone && !(/^\d{10}$/).test(phone)) return failedResponse(res, 400, "invalid phone number")
        if(phone) req.user.phone = phone;
        
        await req.user.save()
        const userObj = req.user.toObject();
        return successResponse(res, 200, "profile updated", userObj);
    } catch (err) {
        console.error("updateProfile error:", err);
        return errorResponse(res, err);
    }
};