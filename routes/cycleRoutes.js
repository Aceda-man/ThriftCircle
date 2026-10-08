import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isGroupMember } from "../middleware/groupAuthMiddleware.js";
import { getCurrentCycle } from "../controllers/cycleController.js";

const router = express.Router();

// Mounted under /groups in routes/index.js → GET /groups/:groupId/cycles/current
router.get("/:groupId/cycles/current", protect, isGroupMember, getCurrentCycle);

export default router;