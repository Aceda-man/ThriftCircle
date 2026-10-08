import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isPayoutGroupOrganizer } from "../middleware/groupAuthMiddleware.js";
import { approvePayout } from "../controllers/payoutController.js";

const router = express.Router();

// Mounted at /payouts in routes/index.js → PATCH /payouts/:payoutId/approve
router.patch("/:payoutId/approve", protect, isPayoutGroupOrganizer, approvePayout);

export default router;