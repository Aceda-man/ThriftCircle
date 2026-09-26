import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0.01
    },
    paymentMethod: {
        type: String,
        enum: ["cash", "bank_transfer", "mobile_money", "card"],
        required: true
    },
    transactionReference: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ["pending", "confirmed", "rejected"],
        default: "pending"
    },
    paidAt: {
        type: Date,
        default: Date.now
    },
    confirmedAt: {
        type: Date
    }
}, {
    timestamps: true
});

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;