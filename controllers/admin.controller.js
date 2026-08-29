import User from "../models/user.models.js";
import Product from "../models/product.models.js";
import Order from "../models/order.model.js";
import Review from "../models/review.models.js";

import {
    successResponse,
    failedResponse,
    errorResponse
} from "../utils/response.js";


//Dashboard

export const getDashboard = async (req, res) => {
    try {
        const [
            totalUsers,
            totalProducts,
            totalOrders,
            pendingOrders,
            deliveredOrders,
            revenue
        ] = await Promise.all([
            User.countDocuments(),
            Product.countDocuments({status: "active"}),
            Order.countDocuments(),
            Order.countDocuments({orderStatus: "pending"}),
            Order.countDocuments({orderStatus: "delivered"}),
            Order.aggregate([
                {
                    $match: {$or: [{"payment.paymentStatus": "paid"}, { orderStatus: "delivered" }]}
                },
                {
                    $group: {_id: null, total: {$sum: "$totalAmount"}}
                }
            ])
        ]);

        return successResponse(
            res,
            200,
            "Dashboard data fetched successfully",
            {
                totalUsers,
                totalProducts,
                totalOrders,
                pendingOrders,
                deliveredOrders,
                totalRevenue: revenue[0]?.total || 0
            }
        );

    } catch (error) {
        console.error("getDashboard:", error);

        return errorResponse(
            res,
            500,
            "Failed to fetch dashboard data"
        );
    }
};


//Users

export const getAllUsers = async (req, res) => {
    try {
        const { name, role, q, sort, order } = req.query;
        const sortOptions = {}
        const query = {}
        if(sort) {
            const orderNo = order === "desc" ? -1 : 1;
            if(sort === "name") sortOptions.name = orderNo
            else if(sort === "createdAt") sortOptions.createdAt = orderNo
            else if(sort === "email") sortOptions.email = orderNo
            else if(sort === "role") sortOptions.role = orderNo
        }
        if(name) query.name = name
        if(role) query.role = role
        if(q) query.$or = [
            { name : { $regex : q, $options : "i"}},
            { email : { $regex : q, $options : "i"}},
            { phone : { $regex : q, $options : "i"}}
        ]
        const users = await User.find(query).sort(sortOptions);
        return successResponse(res, 200, "all users", users);
    } catch (err) {
        console.error("getAllUsers:", err);
        return errorResponse(res, err);
    }
};


export const getUserById = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId)
        if (!user) return failedResponse(res, 404, "User not found");
        const userObj = user.toObject();
        return successResponse(res, 200, "User fetched successfully", userObj);
    } catch (err) {
        console.error("getUserById:", err);
        return errorResponse(res, err);
    }
};

export const getUserActivity = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        if (!user) {
            return failedResponse(res, 404, "User not found");
        }

        const [orders, addresses] = await Promise.all([
            Order.find({ user: userId }).sort({ createdAt: -1 }),
            Address.find({ user: userId }).sort({ isDefault: -1, createdAt: -1 }),
        ]);

        const totalSpend = orders
            .filter(o => !["cancelled", "returned"].includes(o.orderStatus))
            .reduce((sum, o) => sum + (o.totalAmount || o.subTotal || 0), 0);

        const analytics = {
            totalOrders: orders.length,
            totalSpend,
            deliveredOrders: orders.filter(o => o.orderStatus === "delivered").length,
            cancelledOrders: orders.filter(o => o.orderStatus === "cancelled").length,
            returnedOrders: orders.filter(o => o.orderStatus === "returned" || o.returnInformation?.status).length,
            pendingOrders: orders.filter(o => ["pending", "confirmed", "packed", "out for delivery"].includes(o.orderStatus)).length,
            lastOrderDate: orders.length > 0 ? orders[0].createdAt : null,
        };

        return successResponse(res, 200, "User details and activity fetched", {
            user,
            orders,
            addresses,
            analytics,
        })
    } catch (err) {
        console.error("getUserActivityAdmin error:", err);
        return errorResponse(res, err);
    }
}

export const updateUserRole = async (req, res) => {
    try {
        const { userId } = req.params;
        const { role, password } = req.body;
        if(!role) return failedResponse(res, 400, "Please provide a role");
        if (!["admin", "user"].includes(role)) return failedResponse(res, 400, "Invalid role. Must be 'admin' or'user'")
        if(!password) return failedResponse(res, 400, "password required to update roles")
        
        const user = await User.findById(req.user._id).select("+password")
        const isCorrect = await bcrypt.compare(password, user.password)
        if(!isCorrect) return failedResponse(res, 403, "Unauthorized")

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { role },
            { new: true, select: "-password" }
        );
        if (!updatedUser) return failedResponse(res, 404, "User not found")
        return successResponse(res, 200, `User role updated to ${role}`, updatedUser);
    } catch (err) {
        console.error("updateUserRoleAdmin error:", err);
        return errorResponse(res, err);
    }
}

//Products

export const updateProductStock = async (req, res) => {
    try {
        const { productId } = req.params;
        const { stock } = req.body;

        if (stock === undefined || typeof stock !== "number" || stock < 0) return failedResponse(res,400,"Valid stock is required")

        const product = await Product.findById(productId)
        if (!product) return failedResponse(res,404,"Product not found")

        product.stock = stock
        await product.save()

        return successResponse(res,200,"Product stock updated successfully", product)
    } catch (error) {
        console.error("updateProductStock:", error)
        return errorResponse(res,500,"Failed to update product stock")
    }
};



//Orders

export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        const allowedStatuses = [
            "pending",
            "confirmed",
            "packed",
            "shipped",
            "out for delivery",
            "delivered",
            "cancelled",
            "returned"
        ];

        if (!allowedStatuses.includes(status)) {
            return failedResponse(
                res,
                400,
                "Invalid order status"
            );
        }

        const order = await Order.findById(
            orderId
        );

        if (!order) {
            return failedResponse(
                res,
                404,
                "Order not found"
            );
        }

        if (order.orderStatus === "cancelled" && status === "cancelled") {
            return failedResponse(res, 400, "Order is already cancelled");
        }

        const prevStatus = order.orderStatus;
        order.orderStatus = status;

        if (status === "cancelled" && prevStatus !== "cancelled") {
            order.cancellationInformation = {
                reason: req.body.cancelReason || "Cancelled by admin",
                cancelledBy: "admin",
                cancelledAt: new Date(),
            };

            // Restore product stock
            if (order.orderItems?.length) {
                for (const item of order.orderItems) {
                    if (item.product) {
                        await Product.findByIdAndUpdate(item.product, {
                            $inc: { stock: item.quantity }
                        });
                    }
                }
            }
        }

        const timestampField = {
            confirmed: "confirmedAt",
            packed: "packedAt",
            shipped: "shippedAt",
            "out for delivery": "outForDeliveryAt",
            delivered: "deliveredAt"
        }[status];

        if (timestampField) order[timestampField] = new Date()
        await order.save();
        return successResponse(res,200,"Order status updated successfully", order)

    } catch (error) {
        console.error("updateOrderStatus:", error);
        return errorResponse(res,500,"Failed to update order status")
    }
};

//Reviews

export const getAllReviews = async (req, res) => {
    try {
        const reviews = await Review.find().populate("user", "name").populate("product", "name").sort({ createdAt: -1 });
        return successResponse(res,200,"Reviews fetched successfully",reviews)
    } catch (error) {
        console.error("getAllReviews:", error);
        return errorResponse(res,500,"Failed to fetch reviews")
    }
};


export const deleteReviewByAdmin = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const review = await Review.findByIdAndDelete(reviewId)
        if (!review) return failedResponse(res,404,"Review not found")
        return successResponse(res,200,"Review deleted successfully")
    } catch (error) {
        console.error("deleteReviewByAdmin:",error)
        return errorResponse(res,500,"Failed to delete review")
    }
};