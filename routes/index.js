import express from "express";
import healthController from "../controllers/healthcontroller.js";
import authRoutes from "./authRoutes.js";
import groupRoutes from "./groupRoutes.js";
import contributionRoutes from "./contributionRoutes.js";
import contributionByIdRoutes from "./contributionByIdRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import paymentEvidenceRoutes from "./paymentEvidenceRoutes.js";
import payoutRoutes from "./payoutRoutes.js";
import cycleRoutes from "./cycleRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";

const router = express.Router();

router.get("/health", healthController.getHealth);

router.use("/auth", authRoutes);
router.use("/groups", groupRoutes);
router.use("/groups", contributionRoutes);
router.use("/groups", payoutRoutes);
router.use("/groups", cycleRoutes);
router.use("/groups", dashboardRoutes);
router.use("/contributions", contributionByIdRoutes);
router.use("/notifications", notificationRoutes);
router.use("/", paymentEvidenceRoutes);

export default router;