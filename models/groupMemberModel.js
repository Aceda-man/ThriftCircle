import mongoose from "mongoose";

const groupMemberSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true
    }, 

    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    payoutOrder: {
      type: Number,
      required: true,
      min: [1, "Payout order must be at least 1"]
    },

    contributionStatus: {
      type: String,
      enum: ["pending", "paid", "overdue"],
      default: "pending"
    },

    status: {
      type: String,
      enum: ["active", "left"],
      default: "active"
    },

    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  } 
);

groupMemberSchema.index(
  { groupId: 1, memberId: 1 },
  { unique: true }
);

groupMemberSchema.index(
  { groupId: 1, payoutOrder: 1 },
  { unique: true }
);

const GroupMember = mongoose.model("GroupMember", groupMemberSchema);

export default GroupMember;