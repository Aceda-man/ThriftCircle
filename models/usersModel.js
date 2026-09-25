import mongoose from "mongoose";

//Added this so you can know where to continue from//
const userSchema = new mongoose.Schema({
    email :{
        type:String,
        required:true,
        unique:true,
        trim: true,
        lowercase:true
    },
    passwordHash:{
        type:String,
        required:true
    },
    firstName:{
        type:String,
        required:true
    },
    middleName:{
        type:String,
        required: true
    },
    lastName:{
        type:String,
        required:true
    },
    role:{
        type:String,
        enum:['user','admin'],// restricts input to these roles
        default:'user'//for new signups

}
},{
    timestamps:true
});

const User = mongoose.model("User", userSchema);

export default User;
