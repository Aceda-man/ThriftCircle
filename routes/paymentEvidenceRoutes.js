import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js"; // NEW (replaces the inline multer)
import { submitPaymentEvidence, reviewPaymentEvidence } from "../controllers/paymentEvidenceController.js";

const router = express.Router();

// Files are streamed straight to Cloudinary in the controller, so memory storage is fine —
// nothing gets written to disk here.

// POST /contributions/:contributionId/evidence — member submits proof of payment
router.post("/contributions/:contributionId/evidence", protect, upload.single("file"), submitPaymentEvidence);

// PATCH /evidence/:evidenceId/review — organizer approves or rejects
router.patch("/evidence/:evidenceId/review", protect, reviewPaymentEvidence);

export default router;