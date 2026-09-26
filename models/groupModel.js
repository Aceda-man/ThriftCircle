import mongoose from "mongoose"

const groupModelSchema = new mongoose.Schema(
    {
        name : {
            type : String,
            required : true,
            trim : true
        },
        organizer_id : {
            type : mongoose.Schema.Types.ObjectId,
            ref : User,
            required : true
        },
        contribution_amount : {
            type : Number,
            required : true,
            min : 1
        },
        frequency : {
            type : String,
            required : true,
            enum : ["daily", "weekly", "monthly"]
        },
        start_date : {
            type : Date,
            required : true,
        },
        contribution_deadline : {
            type : Date,
            required : true       
        },
        payout_order : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "User",
            default : []
        },
        invite_code : {
            type : String,
            required : true,
            unique : true,
            trim : true
        },
        invite_token : {
            type : String,
            required : true,
            unique : true,
            trim : true
        },
            status : {
            type : String,
            enum : ["active", "completed"],
            default : "active"
        },
        created_at : {
            type : Date,
            default : Date.now
        }
    },
    {
        timestamps : true
    }
)

const GroupModel = mongoose.model("GroupModel", groupModelSchema)

export default GroupModel