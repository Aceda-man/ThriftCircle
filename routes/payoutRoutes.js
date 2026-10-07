import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isGroupMember, isGroupOrganizer, isPayoutGroupOrganizer } from "../middleware/groupAuthMiddleware.js";
import { recordPayout, listGroupPayouts, setPayoutOrder, approvePayout } from "../controllers/payoutController.js";

//payout route has this particular bug that says the filename is wrong
//dont mind it the api run
//yours trully, Adeyemi, lmao
const router = express.Router();

router.post("/:groupId/payouts", protect, isGroupOrganizer, recordPayout);
router.get("/:groupId/payouts", protect, isGroupMember, listGroupPayouts);
router.put("/:groupId/payouts/order", protect, isGroupOrganizer, setPayoutOrder);
router.patch("/payouts/:payoutId/approve", protect, isPayoutGroupOrganizer, approvePayout);

export default router;