import mongoose from "mongoose"

const addressSchema = new mongoose.Schema({
    user : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true,
        index : true
    },
    fullName: {
        type : String,
        required : true,
        trim : true
    },
    phone : {
        type : String,
        required : true,
    },
    addressLine1 : {
        type : String,
        required : true
    },
    addressLine2 : {
        type : String
    },
    city : {
        type : String,
        required : true
    },
    state : {
        type : String,
        required : true,
    },
    country : {
        type : String,
        default : "India"
    },
    pincode : {
        type : String,
        required : true
    },
    addressType : {
        type : String,
        enum : ["home", "work", "other"]
    },
    isDefault : {
        type : Boolean,
        default : false
    }
}, {
    timestamps : true
})

const Address = mongoose.model("Address", addressSchema)

export default Address