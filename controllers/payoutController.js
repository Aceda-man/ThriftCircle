import Payout from "../models/payoutModel.js";
import Cycle from "../models/cycleModel.js";
import Contribution from "../models/contributionModel.js";
import GroupMember from "../models/groupMemberModel.js";
import { createNotification } from "./notificationController.js";
import { checkAndCloseCycle } from "./cycleController.js";

// POST /groups/:groupId/payouts — organizer triggers payout calculation for a cycle.
// Calculates amount from confirmed contributions, creates a PENDING_APPROVAL payout.
// Does NOT close the cycle or notify the recipient yet — that happens on approval.
// Requires isGroupOrganizer to have run first.
export const recordPayout = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { cycleNumber, note } = req.body;

    if (!cycleNumber) {
      return res.status(400).json({ message: "cycleNumber is required." });
    }

    const cycle = await Cycle.findOne({ groupId, cycleNumber });
    if (!cycle) {
      return res.status(404).json({ message: "No such cycle for this group." });
    }

    const existingPayout = await Payout.findOne({ groupId, cycleNumber });
    if (existingPayout) {
      return res.status(409).json({
        message: `A payout already exists for this cycle (status: ${existingPayout.status}).`
      });
    }

    const confirmedContributions = await Contribution.find({
      groupId,
      cycleNumber,
      status: "CONFIRMED"
    });

    if (confirmedContributions.length === 0) {
      return res.status(409).json({
        message: "No confirmed contributions exist for this cycle yet. Nothing to pay out."
      });
    }

    const amount = confirmedContributions.reduce((sum, c) => sum + c.amount, 0);

    const payout = await Payout.create({
      groupId,
      cycleNumber,
      recipientId: cycle.recipientId,
      amount,
      recordedBy: req.user._id,
      note: note || null,
      status: "pending_approval"
    });

    cycle.status = "PAYOUT_PHASE";
    await cycle.save();

    res.status(201).json(payout);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /payouts/:payoutId/approve — any organizer of the payout's group finalizes it.
// This is what actually closes the cycle and notifies the recipient.
// Requires isPayoutGroupOrganizer to have run first.
export const approvePayout = async (req, res) => {
  try {
    const payout = req.payout; // set by isPayoutGroupOrganizer middleware

    if (payout.status !== "pending_approval") {
      return res.status(409).json({ message: `Payout is not pending approval (status: ${payout.status}).` });
    }

    payout.status = "completed";
    await payout.save();

    const cycle = await Cycle.findOne({ groupId: payout.groupId, cycleNumber: payout.cycleNumber });
    if (cycle) {
      cycle.payoutId = payout._id;
      await cycle.save();
    }

    await createNotification(
      payout.recipientId,
      "PAYOUT_COMPLETED",
      "Payout approved",
      `Your payout of ₦${Number(payout.amount).toLocaleString("en-NG")} was approved.`,
      { relatedModel: "Payout", relatedId: payout._id }
    );

    if (cycle) {
      await checkAndCloseCycle(payout.groupId, payout.cycleNumber);
    }

    res.status(200).json(payout);
  } catch (err) {
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
    const { order } = req.body;

    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ message: "order must be a non-empty array of { userId, payoutOrder }." });
    }

    const paidCycles = await Cycle.find({ groupId, payoutId: { $ne: null } });
    const paidUserIds = new Set(paidCycles.map((c) => c.recipientId.toString()));

    for (const entry of order) {
      if (paidUserIds.has(entry.userId)) {
        return res.status(409).json({ message: `User ${entry.userId} has already received a payout and cannot be reordered.` });
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