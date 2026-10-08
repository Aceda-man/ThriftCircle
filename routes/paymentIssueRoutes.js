import express from "express";
import { reportIssue, listIssuesForGroup, resolveIssue } from "../controllers/paymentIssueController.js";

const router = express.Router();

router.post("/issues/report", reportIssue);
router.get("/groups/:groupId/issues", listIssuesForGroup);
router.patch("/issues/:id/resolve", resolveIssue);

export default router;
