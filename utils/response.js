export const successResponse = (res, status, message, data) => {
    return res.status(status).json({
        success : true,
        message,
        data
    })
}

export const failedResponse = (res, status, message) => {
    return res.status(status).json({
        success : false,
        message : message
    })
}

export const errorResponse = (res, err) => {
    return res.status(500).json({
        success : false,
        message : err.message || err || "something went wrong"
    })
}
