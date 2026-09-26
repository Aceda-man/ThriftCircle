import mongoose from "mongoose";

const payoutSchema = new mongoose.Schema(
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
        amount: {
            type: Number,
            required: true,
            min: 0.1 // minimum payout amount is 0.1 naira
        },
        currency: {
            type: String,
            required: true,
            default: "NGN", // since we are in nigeria
            uppercase: true
        },
        // 
        paymentReference: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        bankDetails: {
            bankCode: { type: String, required: true },
            accountNumber: { type: String, required: true },
            accountName: { type: String, required: true },
            bankName: { type: String, required: true }
        },
        status: {
            type: String,
            enum: ["pending", "completed", "processing", "reversed", "failed"],
            default: "pending"
        },
        // to store failed bank transfer
        failureReason: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true 
    }
);

// to make searching for payout faster"
payoutSchema.index({ userId: 1, status: 1 });

// search for "all payouts for this group, optionally by status"
payoutSchema.index({ groupId: 1, status: 1 });

const Payout = mongoose.model("Payout", payoutSchema);
export default Payout;
