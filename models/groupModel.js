import mongoose from "mongoose"

const groupModelSchema = new mongoose.Schema(
    {
        groupName : {
            type : String,
            required : true,
            trim : true
        },
        organizerId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "User",
            required : true
        },
        contributionAmount : {
            type : Number,
            required : true,
            min : [0.01, "Contribution amount must be greater than zero"]
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
        contributionDeadline : {
            type : Date,
            required : true,
            validate: {
                validator: function (value) {
                    return value >= this.startDate},
                message: "Contribution deadline cannot be before the start date."}
        },
        inviteCode : {
            type : String,
            required : true,
            unique : true,
            trim : true
        },
        inviteToken : {
            type : String,
            sparse: true,
            unique : true
        },
            status : {
            type : String,
            enum : ["active", "completed"],
            default : "active"
        },
        
        {
        
        timestamps : true
    }
)

const Group = mongoose.model("Group", groupModelSchema)

export default Group
