import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isGroupMember } from "../middleware/groupAuthMiddleware.js";
import { listGroupContributions, getContributionById, createContribution } from "../controllers/contributionController.js";

const router = express.Router();

// Mounted under /groups in routes/index.js, so this becomes GET /groups/:groupId/contributions
router.get("/:groupId/contributions", protect, isGroupMember, listGroupContributions);

// POST /groups/:groupId/contributions — organizer creates a single contribution due record
router.post("/:groupId/contributions", protect, isGroupMember, createContribution);

export default router;