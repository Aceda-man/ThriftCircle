import mongoose from "mongoose";

const payoutSchema = new mongoose.Schema(
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
        recipientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0.1
        },
        currency: {
            type: String,
            required: true,
            default: "NGN",
            uppercase: true
        },
        recordedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        note: {
            type: String,
            default: null,
            trim: true
        },
        status: {
            type: String,
            enum: ["pending", "completed", "processing", "reversed", "failed"],
            default: "completed"
            // "completed" by default since recordPayout is the organizer confirming
            // a transfer that already happened outside the app — not initiating one.
        },
        failureReason: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

payoutSchema.index({ groupId: 1, cycleNumber: 1 }, { unique: true });
payoutSchema.index({ recipientId: 1, status: 1 });

const Payout = mongoose.model("Payout", payoutSchema);
export default Payout;