import mongoose from mongoose

//Added this so you can know where to continue from//
const userSchema = new mongoose.Schema({
    email :{
        type:String,
        required:true,
        unique:tNrue,
        trim: true,
        lowercase:true
    },
    passwordHash:{
        type:String,
        reqiuired:true
    },
    fristNmae:{
        type:String,
        required:true
    },
    MiddelName:{
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

    },
    timestamps:true
});

const User = mongoose.model('User',userSchema);
module.exports=User;