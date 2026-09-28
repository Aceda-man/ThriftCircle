import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { canAccessContribution } from "../middleware/contributionAuthMiddleware.js";
import { getContributionById } from "../controllers/contributionController.js";

const router = express.Router();

// Mounted at /contributions in routes/index.js → GET /contributions/:contributionId
router.get("/:contributionId", protect, canAccessContribution, getContributionById);

export default router;