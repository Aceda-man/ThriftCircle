import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isGroupOrganizer } from "../middleware/groupAuthMiddleware.js";
import { reportIssue, listIssuesForGroup, resolveIssue } from "../controllers/paymentIssueController.js";

const router = express.Router();

// Mounted at "/" in routes/index.js, so these are the final paths under /api.
router.post("/issues/report", protect, reportIssue);
router.get("/groups/:groupId/issues", protect, isGroupOrganizer, listIssuesForGroup);
router.patch("/issues/:id/resolve", protect, resolveIssue);

export default router;
