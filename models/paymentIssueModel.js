import mongoose from "mongoose";

const paymentIssueSchema = new mongoose.Schema(
  {
    contributionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contribution",
      required: true,
    },
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["REPORTED", "UNDER_REVIEW", "RESOLVED", "CORRECTION_REQUIRED"],
      default: "REPORTED",
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    resolutionNote: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

paymentIssueSchema.index({ contributionId: 1 });

const PaymentIssue = mongoose.model("PaymentIssue", paymentIssueSchema);

export default PaymentIssue;
