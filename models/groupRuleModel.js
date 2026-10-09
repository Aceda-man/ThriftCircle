import mongoose from "mongoose";

const groupRuleSchema = new mongoose.Schema(
    {
        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
            required: true,
            unique: true
        },
        gracePeriodDays: { type: Number, default: 0, min: 0, max: 30 },
        allowLateSubmission: { type: Boolean, default: true },
        maxMembers: { type: Number, default: null, min: 2 },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        }
    },
    { timestamps: true }
);

const GroupRule = mongoose.model("GroupRule", groupRuleSchema);

export default GroupRule;