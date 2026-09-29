import mongoose from "mongoose";

export const notificationType = [
    "GROUP_INVITE",
    "CYCLE_ACTIVATED",
    "CONTRIBUTION_DUE_SOON",
    "CONTRIBUTION_OVERDUE",
    "OVERDUE_ORGANIZER_ALERT",
    "EVIDENCE_SUBMITTED",
    "PAYMENT_CONFIRMED",
    "PAYMENT_FLAGGED",
    "PAYOUT_UPCOMING",
    "PAYOUT_COMPLETED",
    "CYCLE_COMPLETED"
];

const notificationSchema = new mongoose.Schema(
    {
        recipientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        type: {
            type: String,
            enum: notificationType,
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        message: {
            type: String,
            required: true,
            trim: true
        },
        // What the notification is about — the mobile app uses these two to deep-link
        relatedModel: {
            type: String,
            enum: ["Contribution", "PaymentEvidence", "Payout", "Group"]
        },
        relatedId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: "relatedModel"
        },
        isRead: {
            type: Boolean,
            default: false
        },
        readAt: {
            type: Date,
            default: null
        },
        channels: {
            inApp: { type: Boolean, default: true },
            email: { type: Boolean, default: false },
            push: { type: Boolean, default: false }
        },
        // Guards against sending the same notification twice (e.g. the daily job re-running).
        // Only set by the service; never exposed to clients.
        dedupeKey: {
            type: String
        }
    },
    {
        timestamps: true
    }
);

// The main feed query: "my notifications, newest first, optionally unread only"
notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

// Unique only when a dedupeKey is present, so notifications without one are unaffected
notificationSchema.index(
    { dedupeKey: 1 },
    { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } }
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;