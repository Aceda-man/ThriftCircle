import mongoose from "mongoose"

const groupModelSchema = new mongoose.Schema(
    {
        name : {
            type : String,
            required : true,
            trim : true
        },
        description : {
            type : String,
            trim : true
        },
        contributionAmount : {
            type : Number,
            required : true,
            min : 1000
        },
        frequency : {
            type : String,
            required : true,
            enum : ["daily", "weekly", "monthly"]
        },
        startDate : {
            type : Date,
            required : true,
        },
        status : {
            type : String,
            enum : ["active", "completed"],
            default : "active"
        },
        createdBy : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "User",
            requried : true
        }
    },
    {
        timestamps : true
    }
)

const GroupModel = mongoose.model("GroupModel", groupModelSchema)

export default GroupModel