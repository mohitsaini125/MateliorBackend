import mongoose from "mongoose"

const productSchema = new mongoose.Schema({
    name : {
        type : String,
        required : true,
        trim : true,
        minlength : 3,
        maxlength : 100
    },
    description : {
        type : String,
        trim : true,
        maxlength : 1000
    },
    category : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Category",
        required : true
    },
    price : {
        type : Number,
        set : (value)=> Number(value),
        required : true,
        min : 0
    },
    discountPercent : {
        type : Number,
        set : (value)=> Number(value),
        default : 0,
        min : 0,
        max : 100
    },
    stock : {
        type : Number,
        required : true,
        min : 0,
        default : 0
    },
    sku : {
        type : String,
        unique : true,
        trim : true,
        uppercase : true,
        sparse : true
    },
    images : [{
        type : String
    }],
    material : {
        type : String,
        enum : ["stainless steel", "leather", "rope", "alloy", "titanium"]
    },
    colors : [{
        type : String
    }],
    weight : {
        type : Number,
        min : 0
    },
    tags : [{
        type : String,
        lowercase : true,
        trim : true
    }],
    status : {
        type : String,
        enum : ["active", "hidden"],
        default : "active"
    }

}, {
    timestamps : true
})

const Product = mongoose.model("Product", productSchema)

export default Product;