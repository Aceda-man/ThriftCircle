import mongoose from "mongoose";

const paymentEvidenceSchema = new mongoose.Schema(
    {
        contributionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contribution",
            required: true
        },
        submittedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        fileUrl: {
            type: String,
            required: true,
            trim: true
            // Cloudinary for url too
        },
        filePublicId: {
            type: String,
            required: true,
            trim: true
        },
            // we will use cloudinary for file//
        fileType: {
            type: String,
            enum: ["image", "pdf"],
            required: true
        },
        note: {
            type: String,
            trim: true,
            default: null
        },
        reviewStatus: {
            type: String,
            enum: ["PENDING", "APPROVED", "REJECTED"],
            default: "PENDING"
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        reviewedAt: {
            type: Date,
            default: null
        },
        reviewNote: {
            type: String,
            trim: true,
            default: null,
            validate: {
                validator: function (value) {
                    return this.reviewStatus !== "REJECTED" || (value && value.length > 0);
                },
                message: "review note is required when review is rejected 'REJECTED'"
            }
        }
    },
    {
        timestamps: true
    }
);

paymentEvidenceSchema.index({ contributionId: 1, createdAt: -1 });
paymentEvidenceSchema.index({ submittedBy: 1, reviewStatus: 1 });

const PaymentEvidence = mongoose.model("PaymentEvidence", paymentEvidenceSchema);

export default PaymentEvidence;