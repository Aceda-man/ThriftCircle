import mongoose from "mongoose";

const groupMemberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    joinedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "pending", "removed"],
      default: "active",
    },
    role: {
      type: String,
      enum: ["member", "organizer"],
      default: "member",
    },
    // Position in the payout rotation, assigned in join order (1, 2, 3...).
    // Used to work out whose turn it is each cycle — see cron/contributionScheduler.js.
    payoutOrder: {
    type: Number,
    required: false,
    min: 1,
    default: null
},
  },
  {
    timestamps: true,
  },
);

groupMemberSchema.index({ userId: 1, groupId: 1 }, { unique: true });

const GroupMember = mongoose.model("GroupMember", groupMemberSchema);

export default GroupMember;