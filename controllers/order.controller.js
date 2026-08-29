import mongoose from "mongoose";
import Address from "../models/address.model.js"
import Cart from "../models/cart.model.js"
import { errorResponse, failedResponse, successResponse } from "../utils/response.js"
import Order from "../models/order.model.js";
import generateOrderNumber from "../utils/orderNumber.js";
import Product from "../models/product.models.js";
import Payment from "../models/payment.model.js"

//User API controllers

export const createOrder = async (req, res)=> {
    let session;
    try {
        
        const userId = req.user._id
        const { addressId, discountAmount, discountPercent, paymentMethod } = req.body
        
        session = await mongoose.startSession()
        await session.withTransaction(async ()=> {

        let address;
        if(!addressId) {
            address = await Address.findOne({ user : userId, isDefault : true }).session(session)
        } else {
            address = await Address.findOne({ _id : addressId, user : userId }).session(session)
        }

        const cart = await Cart.findOne({ user : userId }).session(session).populate("items.product")
        if(!cart) {
            return failedResponse(res, 404, "Cart does not exist.")
        }

        if(cart.items.length===0) {
            return failedResponse(res, 404, "Cart is empty.")
        }

        if (!address) {
            return failedResponse(res, 404, "Address does not exist")
        }
        
        const cartItems = cart.items

        for (let i=0; i < cartItems.length; i++) {
            const cartItem = cartItems[i]
            if(cartItem.product.status === "active") {
                if(cartItem.product.stock < cartItem.quantity) {
                        return failedResponse(res, 409, {
                            product : cartItem.product.name,
                            availableStock : cartItem.product.stock,
                            requestedQuantity : cartItem.quantity
                        })
                }
            } else {
                return res.status(404).json({
                    success : false,
                    message : "Product unavailable",
                    data : {
                        product : {
                            name : cartItem.product.name,
                            description : cartItem.product.description
                        }
                    }
                })
            }
        }

        let subtotal = 0;
        for (let i=0; i < cartItems.length; i++) {
            const cartItem = cartItems[i]
            const unitPrice = cartItem.product.discountPercent
                ? Math.round(cartItem.product.price * (1 - cartItem.product.discountPercent / 100))
                : cartItem.product.price;
            subtotal = subtotal + unitPrice * cartItem.quantity
        }

        if(discountAmount && discountPercent) {
            return failedResponse(res, 400, "Discount can be either amount or percentage.")
        }

        let finalAmount;
        if(discountAmount || discountPercent) {
            if(discountAmount) {
                if(discountAmount > subtotal) {
                return failedResponse(res, 400, "Discount amount cannot be greater than the subtotal amount.")
                }
            finalAmount = subtotal - discountAmount
            }
            if(discountPercent) {
            finalAmount = subtotal * (1 - discountPercent/100)
            }
        } else {
            finalAmount = subtotal
        }


        finalAmount = Number(finalAmount.toFixed(2))

        const shippingCharge = finalAmount > 999 ? 0 : 99

        if(shippingCharge) {
            finalAmount = finalAmount + shippingCharge
        }

        
        const orderItems = []
        for (let i=0; i < cartItems.length; i++) {
            const cartItem = cartItems[i]
            const unitPrice = cartItem.product.discountPercent
                ? Math.round(cartItem.product.price * (1 - cartItem.product.discountPercent / 100))
                : cartItem.product.price;
            orderItems.push({
                product : cartItem.product._id,
                productName : cartItem.product.name,
                productImage : cartItem.product.images?.[0] || "",
                productPrice : unitPrice,
                quantity : cartItem.quantity
            })
        }
        
        
            const estimatedDeliveryDate = new Date()
            estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 5)
            const orderNumber = await generateOrderNumber(session)

            // Order.create([...]) with an array argument returns an ARRAY of
            // documents, not a single document. Keep the created doc under
            // its own name so downstream code (Payment.create below) can't
            // accidentally read .._id / .totalAmount off the array itself.
            const createdOrders = await Order.create([{
                user : userId,
                orderItems : orderItems,
                subTotal : subtotal,
                discount : {
                    discountPercent : discountPercent,
                    discountAmount : discountAmount
                },
                shippingCharge : shippingCharge,
                totalAmount : finalAmount,
                shippingAddress : {
                    fullName : address.fullName,
                    phone : address.phone,
                    addressLine1 : address.addressLine1,
                    addressLine2 : address.addressLine2,
                    city : address.city,
                    state : address.state,
                    pincode : address.pincode,
                    country : address.country
                },
                orderNumber : orderNumber,
                estimatedDeliveryDate : estimatedDeliveryDate
            }], { session })

            const order = createdOrders[0]

            await Payment.create({
                order : order._id,
                user : userId,
                amount : order.totalAmount,
                method : paymentMethod
            }, { session })

            for (let i=0; i < cartItems.length; i++) {
            const cartItem = cartItems[i]
            await Product.findOneAndUpdate({
                _id : cartItem.product._id,
                stock : { $gte : cartItem.quantity}
            }, {
                $inc : {
                    stock : -cartItem.quantity
                }
            }, { session })
        }

        cart.items = []
        await cart.save({ session })

            return successResponse(res, 201, "Order created successfully", order)
        })
    } catch(err) {
        return errorResponse(res, err)
    } finally {
        if(session) {
            await session.endSession()
        }
    }
}


export const getOrders = async (req, res) => {
    try {
        const userId = req.user._id;
        const { status, sort, order } = req.query;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
        const skip = (page - 1) * limit;

        const sortOptions = {};
        if (sort === "totalAmount") {
            sortOptions.totalAmount = order === "asc" ? 1 : -1;
        } else {
            sortOptions.createdAt = order === "asc" ? 1 : -1;
        }

        const filter = { user: userId };
        if (status) filter.orderStatus = status;

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .sort(sortOptions)
                .skip(skip)
                .limit(limit)
                .populate("orderItems.product"),
            Order.countDocuments(filter),
        ]);

        const totalPages = Math.ceil(total / limit) || 1;

        return successResponse(res, 200, "fetched orders", {
            items: orders,
            page,
            limit,
            total,
            totalPages,
        });
    } catch (err) {
        console.error("getOrder error:", err);
        return errorResponse(res, err);
    }
};

export const getOrderById = async (req, res) => {
    try {
        const { orderId } = req.params
        const userId = req.user._id;
        const query = req.user.role === "admin"
            ? { _id: orderId }
            : { user: userId, _id: orderId }

        const order = await Order.findOne(query)
            .populate("user", "name email phone")
            .populate("orderItems.product")

        if (!order) return failedResponse(res, 404, "order does not exist")
        return successResponse(res, 200, "Order details fetched", order)
    } catch (err) {
        console.error("getOrderById error:", err)
        return errorResponse(res, err)
    }
}

export const returnOrder = async (req, res)=> {
    try {
        const orderId = req.params.orderId
        const userId = req.user._id
        const { returnReason } = req.body
        if(!returnReason) return failedResponse(res, 400, "return reason is required")
        const order = await Order.findOne({ user : userId, _id : orderId })
        if(!order) return failedResponse(res, 404, "order does not exist")
        if(order.returnInformation.status) {
            return failedResponse(res, 409, "return already in process")
        }
        if(order.orderStatus === "delivered") {
            const updatedOrder = await Order.findOneAndUpdate(
                { user : userId, _id : orderId },
                {
                    returnInformation : {
                        reason : returnReason,
                        status : "requested",
                        requestedAt : new Date()
                    },
                },
                { returnDocument : "after" }
            )
            return successResponse(res, 200, "return request sent", updatedOrder)
        }
        return failedResponse(res, 400, "return request not valid (delivered products only !)")
    } catch(err) {
        errorResponse(res, err)
    }
}

export const cancelOrder = async (req, res)=> {
    try {
        const orderId = req.params.orderId
        const userId = req.user._id
        const order = await Order.findOne({ user: userId, _id: orderId })
        if(!order) {
            return failedResponse(res, 404, "order does not exist")
        }
        if(order.orderStatus === "cancelled") {
            return failedResponse(res, 409, "order already cancelled")
        }
        const cancellableStatus = ["pending", "confirmed", "packed"]
        const isCancellable = cancellableStatus.find(s => s === order.orderStatus)

        if(!isCancellable) return failedResponse(res, 400, "Order is not eligible for cancellation")
        if (order.orderItems?.length) {
            for (const item of order.orderItems) {
                //restore stock
                if (item.product) {
                    await Product.findByIdAndUpdate(item.product, {
                        $inc: { stock: item.quantity }
                    });
                }
            }
        }

        const updatedOrder = await Order.findOneAndUpdate(
            { user: userId, _id: orderId },
            { cancellationInformation : {
                reason : req.body.cancellationReason || "Cancelled by user",
                cancelledBy : "user",
                cancelledAt : new Date()
            },
            orderStatus : "cancelled"
        },
            { returnDocument : "after" }
        )
        return successResponse(res, 200, "order cancelled successfully", updatedOrder)

    } catch(err) {
        return errorResponse(res, err)
    }
}

//Admin API controllers

export const getAllOrdersAdmin = async (req, res) => {
    try {
        const { status, sort, order } = req.query;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, parseInt(req.query.limit, 10) || 50);
        const skip = (page - 1) * limit;

        const sortOptions = {};
        if (sort === "totalAmount") {
            sortOptions.totalAmount = order === "asc" ? 1 : -1;
        } else {
            sortOptions.createdAt = order === "asc" ? 1 : -1;
        }

        const filter = {};
        if (status) filter.orderStatus = status;

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .sort(sortOptions)
                .skip(skip)
                .limit(limit)
                .populate("user", "name email phone")
                .populate("orderItems.product"),
            Order.countDocuments(filter),
        ]);

        const totalPages = Math.ceil(total / limit) || 1;

        return successResponse(res, 200, "all admin orders", {
            items: orders,
            page,
            limit,
            total,
            totalPages,
        });
    } catch (err) {
        console.error("getAllOrdersAdmin error:", err);
        return errorResponse(res, err);
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const requestedStatus = (req.body.orderStatus || "").trim().toLowerCase();
        const order = await Order.findById(orderId);
        if (!order) {
            return failedResponse(res, 404, "Order does not exist");
        }

        const transitionMap = {
            "pending": ["confirmed", "cancelled"],
            "confirmed": ["packed", "cancelled"],
            "packed": ["shipped", "out for delivery", "cancelled"],
            "shipped": ["out for delivery", "delivered"],
            "out for delivery": ["delivered"],
            "delivered": ["returned"],
        };

        const updateObject = {
            "confirmed": "confirmedAt",
            "packed": "packedAt",
            "shipped": "shippedAt",
            "out for delivery": "outForDeliveryAt",
            "delivered": "deliveredAt",
        };

        const currentStatus = order.orderStatus;
        const allowedNextStatuses = transitionMap[currentStatus] || [];

        if (!allowedNextStatuses.includes(requestedStatus)) {
            return failedResponse(res,400,`Invalid status transition from '${currentStatus}' to '${requestedStatus}'. Allowed next: ${allowedNextStatuses.join(", ")}`)
        }

        if (requestedStatus === "cancelled") {
            if (order.orderStatus === "cancelled") {
                return failedResponse(res, 400, "Order is already cancelled");
            }

            if (order.orderItems?.length) {
                for (const item of order.orderItems) {
                    if (item.product) {
                        await Product.findByIdAndUpdate(item.product, {
                            $inc: { stock: item.quantity }
                        });
                    }
                }
            }

            const updatedOrder = await Order.findByIdAndUpdate(
                orderId,
                {
                    orderStatus: "cancelled",
                    cancellationInformation: {
                        reason: req.body.cancelReason || "Cancelled by admin",
                        cancelledBy: "admin",
                        cancelledAt: new Date(),
                    },
                },
                { returnDocument: "after" }
            );
            return successResponse(res, 200, "Order status updated to cancelled.", updatedOrder);
        }

        const updateFields = { orderStatus: requestedStatus };
        if (updateObject[requestedStatus]) {
            updateFields[updateObject[requestedStatus]] = new Date();
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            {
                orderStatus: requestedStatus,
                [updateObject[requestedStatus]] : new Date()
            },
            { returnDocument: "after" }
        );
        return successResponse(res, 200, "Order status updated successfully.", updatedOrder);
    } catch (err) {
        console.error("updateOrderStatus error:", err);
        return errorResponse(res, err);
    }
};

export const updateReturnStatus = async (req, res)=> {
    try {
        const orderId = req.params.orderId
        const order = await Order.findById(orderId)
        if(!order) {
            return failedResponse(res, 404, "order does not exist")
        }
        if (!order.returnInformation?.status) {
            return failedResponse(res, 400, "return request does not exist");
        }
        const statusObj = {
            requested : "approved",
            approved : "picked",
            picked : "completed"
        }

        const updateObject = {
            approved : "approvedAt",
            picked : "pickedAt",
            completed : "completedAt"
        }

        const requestedStatus = req.body.status
        const currentStatus = order.returnInformation.status
        const allowedNextStatus = statusObj[currentStatus]
        if(requestedStatus !== allowedNextStatus) {
            return failedResponse(res, 400, "invalid status transition")
        }
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            {
                "returnInformation.status" : requestedStatus,
                [`returnInformation.${updateObject[requestedStatus]}`] : new Date
            },
            {
                returnDocument : "after"
            }
        )

        if(requestedStatus === "completed") {
            await Order.findByIdAndUpdate(
                orderId,
                {
                    "refundInformation.status" : "processing",
                    "refundInformation.initiatedAt" : new Date()
                }
            )
        }
        return successResponse(res, 200, "return status updated", updatedOrder)

    } catch(err) {
        return errorResponse(res, err)
    }
}

export const updateRefundStatus = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId);
        if (!order) return failedResponse(res, 404, "order does not exist");
        if (!order.refundInformation?.status) return failedResponse(res, 400, "refund request does not exist");

        if (order.refundInformation.status === "refunded") return failedResponse(res, 409, "Order already refunded.");

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            {
                "refundInformation.status" : "refunded",
                "refundInformation.completedAt" : new Date(),
                "payment.paymentStatus" : "refunded",
                orderStatus : "refunded",
            },
            { returnDocument : "after" }
        )

        return successResponse(res, 200, "Refund status updated successfully", updatedOrder)
    } catch(err) {
        console.error("updateRefundStatus error:", err)
        return errorResponse(res, err)
    }
};


// CUSTOMER APIs

// create order post-> /order            - done
// => create a new order from the user's cart

// get order get-> /Order                - done
// return all the orders of the logged in user (pagination, sort, filter by status)

// get orderById get-> /order/:orderId   - done
// returns complete details of one order

// cancel order patch-> /order/:orderId/cancel   -done
// customers can cancel only if the order is eligible to get cancelled

// request return patch-> /order/:orderId/return   - done
// creates a return request




// ADMIN APIs

// get all orders get-> /admin/order        - done   
// get all the orders in order collection (with pagination, filter, sort, search)      done

// get order details get-> /admin/order/:orderId      - done
// get all the details of a particular order

// Update order status patch-> /admin/order/:orderId/status (pending -> confirmed -> packed -> shipped -> out for delivery -> delivered)       - done 

// refund patch-> /admin/order/:orderId/refund (paymentStatus -> refunded)  - done