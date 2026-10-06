import Payout from "../models/payoutModel.js";
import Cycle from "../models/cycleModel.js";
import GroupMember from "../models/groupMemberModel.js";
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

// PUT /groups/:groupId/payouts/order — organizer reorders members not yet paid.
// Requires isGroupOrganizer to have run first.
export const setPayoutOrder = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { order } = req.body; // array of { userId, payoutOrder }

    if (!Array.isArray(order) || order.length === 0) {
      return res
        .status(400)
        .json({ message: "order must be a non-empty array of { userId, payoutOrder }." });
    }

    // Only allow reordering members who haven't already received a payout —
    // find everyone who HAS been paid, to make sure none of them are in this request.
    const paidCycles = await Cycle.find({ groupId, payoutId: { $ne: null } });
    const paidUserIds = new Set(paidCycles.map((c) => c.recipientId.toString()));

    for (const entry of order) {
      if (paidUserIds.has(entry.userId)) {
        return res
          .status(409)
          .json({ message: `User ${entry.userId} has already received a payout and cannot be reordered.` });
      }
    }

    await Promise.all(
      order.map(({ userId, payoutOrder }) =>
        GroupMember.updateOne({ groupId, userId }, { $set: { payoutOrder } })
      )
    );

    const updatedMembers = await GroupMember.find({ groupId, status: "active" }).sort({ payoutOrder: 1 });

    res.status(200).json(updatedMembers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};