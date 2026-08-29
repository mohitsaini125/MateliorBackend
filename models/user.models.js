import mongoose from "mongoose"

const userSchema = new mongoose.Schema({
    name : {
        type : String,
        required : true,
        minlength : 3,
        trim : true
    },
    email : {
        type : String,
        required : true,
        minlength : 5,
        trim : true,
        lowercase : true
    },
    password : {
        type : String,
        minlength : 6,
        required : true,
        trim : true,
        select: false
    },
    role : {
        type : String,
        required : true,
        enum : ['user', 'admin', 'superadmin'],
        default : "user"
    },
    phone : {
        type : String,
        trim : true
    }
}, { timestamps: true })

const User = mongoose.model("User", userSchema);

export default User;