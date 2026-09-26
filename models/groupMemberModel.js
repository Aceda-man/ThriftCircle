import mongoose from "mongoose";

const groupMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },

    joinedAt: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["active", "pending", "removed"],
      default: "active",
    },

    role: {
      type: String,
      enum: ["member", "admin"],
      default: "member",
    },
  },
  {
    timestamps: true,
  },
);

const GroupMember = mongoose.model("GroupMember", groupMemberSchema);

export default GroupMember;
