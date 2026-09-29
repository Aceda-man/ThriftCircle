import Payout from "../models/payoutModel.js";
import Cycle from "../models/cycleModel.js";
import { createNotification } from "./notificationController.js";
import { checkAndCloseCycle } from "./cycleController.js";

// POST /groups/:groupId/payouts — organizer confirms a payout happened.
// ThriftCircle doesn't move money itself; this record IS the confirmation.
// Requires isGroupOrganizer to have run first.
export const recordPayout = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { cycleNumber, amount, note } = req.body;

    if (!cycleNumber || amount === undefined) {
      return res
        .status(400)
        .json({ message: "cycleNumber and amount are required." });
    }

    const cycle = await Cycle.findOne({ groupId, cycleNumber });
    if (!cycle) {
      return res.status(404).json({ message: "No such cycle for this group." });
    }
    if (cycle.payoutId) {
      return res
        .status(409)
        .json({
          message: "A payout has already been recorded for this cycle.",
        });
    }

    const payout = await Payout.create({
      groupId,
      cycleNumber,
      recipientId: cycle.recipientId,
      amount,
      recordedBy: req.user._id,
      note: note || null,
    });

    cycle.payoutId = payout._id;
    await cycle.save();

    await createNotification(
      cycle.recipientId,
      "PAYOUT_COMPLETED",
      "Payout recorded",
      `Your payout of ₦${Number(amount).toLocaleString("en-NG")} was recorded for this cycle.`,
      { relatedModel: "Payout", relatedId: payout._id },
    );

    // Payout being recorded is one of the two conditions for closing the cycle —
    // check now, since evidence approval may have already handled the other one.
    await checkAndCloseCycle(groupId, cycleNumber);

    res.status(201).json(payout);
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({
          message: "A payout has already been recorded for this cycle.",
        });
    }
    res.status(500).json({ message: err.message });
  }
};

// GET /groups/:groupId/payouts — payout history for a group
export const listGroupPayouts = async (req, res) => {
  try {
    const payouts = await Payout.find({ groupId: req.params.groupId })
      .sort({ cycleNumber: -1 })
      .populate("recipientId", "fullName");

    res.status(200).json(payouts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
