import Cycle from "../models/cycleModel.js";
import Contribution from "../models/contributionModel.js";
import GroupMember from "../models/groupMemberModel.js";

// Called after a contribution gets CONFIRMED, and again once a payout is recorded
// for a cycle. Closes the cycle only when BOTH conditions hold:
//   1. every active member's contribution for this cycle is CONFIRMED
//   2. a payout has been recorded (cycle.payoutId is set)
// Safe to call anytime — does nothing if the cycle is already closed or not ready.
export const checkAndCloseCycle = async (groupId, cycleNumber) => {
    const cycle = await Cycle.findOne({ groupId, cycleNumber });
    if (!cycle || cycle.status === "COMPLETED") return null;
    if (cycle.status !== "PAYOUT_PHASE") return cycle; // not in payout phase yet
    if (!cycle.payoutId) return cycle; // payout not recorded yet — not ready

    const activeMemberCount = await GroupMember.countDocuments({ groupId, status: "active" });

    const confirmedCount = await Contribution.countDocuments({
        groupId,
        cycleNumber,
        status: "CONFIRMED"
    });

    if (confirmedCount < activeMemberCount) return cycle; // still waiting on someone

    cycle.status = "COMPLETED";
    cycle.closedAt = new Date();
    await cycle.save();

    return cycle;
};

// GET /groups/:groupId/cycles/current
export const getCurrentCycle = async (req, res) => {
    try {
        const cycle = await Cycle.findOne({
            groupId: req.params.groupId,
            status: { $in: ["ACTIVE", "PAYOUT_PHASE"] }
        }).sort({ cycleNumber: -1 });

        if (!cycle) {
            return res.status(404).json({ message: "No active cycle for this group." });
        }

        res.status(200).json(cycle);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};