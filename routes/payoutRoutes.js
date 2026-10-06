import express from "express";
import { protect } from "../middleware/authMiddleware.js";
//payout route has this particular bug that says the filename is wrong
//dont mind it the api run
//yours trully, Adeyemi, lmao
import { isGroupMember, isGroupOrganizer } from "../middleware/groupAuthMiddleware.js";
import { recordPayout, listGroupPayouts, setPayoutOrder } from "../controllers/payoutController.js";

const router = express.Router();

// Mounted under /groups in routes/index.js
router.post("/:groupId/payouts", protect, isGroupOrganizer, recordPayout);
router.get("/:groupId/payouts", protect, isGroupMember, listGroupPayouts);
router.put("/:groupId/payouts/order", protect, isGroupOrganizer, setPayoutOrder);

export default router;