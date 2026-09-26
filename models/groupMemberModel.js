import mongoose from "mongoose";

const groupMemberSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
            required: true
        },
        joinedAt: {
            type: Date,
            default: null
            // set when status transitions from "pending" to "active"
        },
        status: {
            type: String,
            enum: ["active", "pending", "removed"],
            default: "active"
        },
        role: {
            type: String,
            enum: ["member", "organizer"],
            default: "member"
        }
    },
    {
        timestamps: true
    }
);

groupMemberSchema.index({ userId: 1, groupId: 1 }, { unique: true });

const GroupMember = mongoose.model("GroupMember", groupMemberSchema);

export default GroupMember;