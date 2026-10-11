import mongoose from "mongoose";
import AuditRecord, { auditActions } from "../models/auditRecordModel.js";

// GET /groups/:groupId/audit?action=&actorId=&page=1&limit=25
// Requires isGroupOrganizer to have run first.
export const listGroupAudit = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { action, actorId } = req.query;

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 100);

        const filter = { groupId };

        if (action !== undefined) {
            if (!auditActions.includes(action)) {
                return res.status(400).json({ message: `action must be one of: ${auditActions.join(", ")}` });
            }
            filter.action = action;
        }

        if (actorId !== undefined) {
            if (typeof actorId !== "string" || !mongoose.isValidObjectId(actorId)) {
                return res.status(400).json({ message: "actorId must be a valid user id." });
            }
            filter.actorId = actorId;
        }

        const [records, total] = await Promise.all([
            AuditRecord.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate("actorId", "fullName email")
                .select("-__v"),
            AuditRecord.countDocuments(filter)
        ]);

        res.status(200).json({ records, page, limit, total });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};