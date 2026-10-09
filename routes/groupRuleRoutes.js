import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isGroupMember, isGroupOrganizer } from "../middleware/groupAuthMiddleware.js";
import { getGroupRules, setGroupRules } from "../controllers/groupRuleController.js";

const router = express.Router();

// Mounted under /groups in routes/index.js
router.get("/:groupId/rules", protect, isGroupMember, getGroupRules);
router.put("/:groupId/rules", protect, isGroupOrganizer, setGroupRules);

export default router;