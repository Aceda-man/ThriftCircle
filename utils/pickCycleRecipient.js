import GroupMember from "../models/groupMemberModel.js";
import Cycle from "../models/cycleModel.js";

// Picks who should be this cycle's recipient: the active member with the lowest
// payoutOrder who hasn't already received a payout (no completed Cycle naming them
// as recipientId with a payoutId set).
export const pickCycleRecipient = async (groupId) => {
    const members = await GroupMember.find({ groupId, status: "active" }).sort({ payoutOrder: 1 });

    const paidCycles = await Cycle.find({ groupId, payoutId: { $ne: null } });
    const paidUserIds = new Set(paidCycles.map((c) => c.recipientId.toString()));

    const nextRecipient = members.find((m) => !paidUserIds.has(m.userId.toString()));

    return nextRecipient ? nextRecipient.userId : null; // null if everyone's already been paid
};