import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isGroupMember, isGroupOrganizer } from "../middleware/groupAuthMiddleware.js";
import { getOrganizerDashboard, getMemberDashboard, getOutstandingContributions, getGroupProgress } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/:groupId/dashboard/organizer", protect, isGroupOrganizer, getOrganizerDashboard);
router.get("/:groupId/dashboard/member", protect, isGroupMember, getMemberDashboard);
router.get("/:groupId/outstanding", protect, isGroupMember, getOutstandingContributions);
router.get("/:groupId/progress", protect, isGroupMember, getGroupProgress);

export default router;