import mongoose from "mongoose";

const cycleSchema = new mongoose.Schema(
    {
        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
            required: true
        },
        cycleNumber: {
            type: Number,
            required: true,
            min: 1
        },
        // Whose turn it is to receive this cycle's payout, set by the rotation
        // logic when the cycle is created — see cron/contributionScheduler.js.
        recipientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        status: {
            type: String,
            enum: ["ACTIVE", "PAYOUT_PHASE", "COMPLETED"],
            default: "ACTIVE"
        },
        openedAt: {
            type: Date,
            default: Date.now
        },
        closedAt: {
            type: Date,
            default: null
        },
        payoutId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Payout",
            default: null
        }
    },
    {
        timestamps: true
    }
);

cycleSchema.index({ groupId: 1, cycleNumber: 1 }, { unique: true });

const Cycle = mongoose.model("Cycle", cycleSchema);

export default Cycle;