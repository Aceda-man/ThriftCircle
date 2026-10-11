import AuditRecord from "../models/auditRecordModel.js";

// Writes one audit record. Never throws: a failed audit write must not break
// the action being recorded, so errors are only logged.
export const logAudit = async ({ groupId, actorId = null, action, targetModel, targetId, metadata = {} }) => {
    try {
        await AuditRecord.create({ groupId, actorId, action, targetModel, targetId, metadata });
    } catch (err) {
        console.error(`[audit] Failed to log ${action}:`, err.message);
    }
};