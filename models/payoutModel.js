import mongoose from "mongoose";

const payoutModelSchema = new mongoose.Schema(
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

    cycle: {
      type: Number,
      required: true,
      min: [1, "Cycle must be at least 1"]
    },

    payoutAmount: {
      type: Number,
      required: true,
      min: [0.01, "Payout amount must be greater than zero"]
    },

    scheduledDate: {
      type: Date,
      required: true
    },

    paidAt: {
      type: Date,
      default: null
    },

    status: {
      type: String,
      enum: ["pending", "paid", "missed", "cancelled"],
      default: "pending"
    }
  },
  {
    timestamps: true
  }
);

payoutModelSchema.index(
  { groupId: 1, memberId: 1, cycle: 1 },
  { unique: true }
);

payoutModelSchema.index(
  { groupId: 1, payoutOrder: 1, cycle: 1 },
  { unique: true }
);

const Payout = mongoose.model("Payout", payoutModelSchema);

export default Payout;