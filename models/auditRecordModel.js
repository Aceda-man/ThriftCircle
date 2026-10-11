import mongoose from "mongoose";

export const auditActions = [
    "CONTRIBUTION_CREATED",
    "CONTRIBUTION_MARKED_OVERDUE",
    "EVIDENCE_SUBMITTED",
    "EVIDENCE_APPROVED",
    "EVIDENCE_REJECTED",
    "ISSUE_REPORTED",
    "ISSUE_UPDATED",
    "PAYOUT_CREATED",
    "PAYOUT_APPROVED",
    "PAYOUT_ORDER_CHANGED",
    "MEMBER_REQUESTED",
    "MEMBER_APPROVED",
    "MEMBER_REJECTED",
    "RULES_UPDATED",
    "CYCLE_CREATED",
    "CYCLE_COMPLETED"
];

export const auditTargetModels = [
    "Contribution",
    "PaymentEvidence",
    "PaymentIssue",
    "Payout",
    "Cycle",
    "Group",
    "GroupMember"
];

const auditRecordSchema = new mongoose.Schema(
    {
        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
            required: true
        },
        // null means the system did it (cron, automatic cycle close)
        actorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        action: {
            type: String,
            enum: auditActions,
            required: true
        },
        targetModel: {
            type: String,
            enum: auditTargetModels,
            required: true
        },
        targetId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: "targetModel",
            required: true
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: { createdAt: true, updatedAt: false }
    }
);

auditRecordSchema.index({ groupId: 1, createdAt: -1 });
auditRecordSchema.index({ targetModel: 1, targetId: 1 });

// Append-only: the app can never edit or remove an audit record.
// (This only guards the app; editing in the Atlas UI bypasses it.)
const blockChanges = async function () {
    throw new Error("Audit records are append-only and cannot be modified or deleted.");
};
["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne", "findOneAndDelete", "deleteMany"]
    .forEach((op) => auditRecordSchema.pre(op, blockChanges));

const AuditRecord = mongoose.model("AuditRecord", auditRecordSchema);

export default AuditRecord;