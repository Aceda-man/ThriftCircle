import express from "express";

import { 
    confirmPayout, 
    getPayoutHistory 
} from "../controllers/payoutController.js"

const router = express.Router();


// Organizer confirms a payout
router.post(
  "/groups/:groupId/payout",
  confirmPayout
);


// Get payout history
router.get(
  "/groups/:groupId/payouts",
  getPayoutHistory
);

export default router;