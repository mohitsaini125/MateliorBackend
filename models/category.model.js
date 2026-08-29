import mongoose from "mongoose"

const categorySchema = new mongoose.Schema({
    name : {
        type : String,
        required : true,
        unique : true,
        trim : true
    },
    image : {
        type : String,
        required : true,
        trim : true
    },
    description : {
        type : String,
        required : true,
        trim : true
    },
    status : {
        type : String,
        enum : ["active", "hidden"],
        default : "active"
    }
}, { timestamps: true })

const Category = mongoose.model("Category", categorySchema)

export default Category;