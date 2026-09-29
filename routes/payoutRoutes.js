import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isGroupMember, isGroupOrganizer } from "../middleware/groupAuthMiddleware.js";
import { recordPayout, listGroupPayouts } from "../controllers/payoutController.js";

const router = express.Router();

// Mounted under /groups in routes/index.js
router.post("/:groupId/payouts", protect, isGroupOrganizer, recordPayout);
router.get("/:groupId/payouts", protect, isGroupMember, listGroupPayouts);

export default router;