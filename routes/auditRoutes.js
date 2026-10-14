import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isGroupOrganizer } from "../middleware/groupauthMiddleware.js";
import { listGroupAudit } from "../controllers/auditController.js";

const router = express.Router();

// Mounted under /groups in routes/index.js
router.get("/:groupId/audit", protect, isGroupOrganizer, listGroupAudit);

export default router;
