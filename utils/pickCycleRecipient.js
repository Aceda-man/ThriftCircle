import GroupMember from "../models/groupMemberModel.js";
import Cycle from "../models/cycleModel.js";

// Picks the next recipient: the active member with the lowest payoutOrder who has not
// already been given a cycle (paid or not), so every member gets exactly one turn.
// Returns null once every active member has had a turn.
export const pickCycleRecipient = async (groupId) => {
    const members = await GroupMember.find({ groupId, status: "active" }).sort({ payoutOrder: 1 });

    const existingCycles = await Cycle.find({ groupId }).select("recipientId");
    const hadTurn = new Set(existingCycles.map((c) => c.recipientId.toString()));

    const next = members.find((m) => !hadTurn.has(m.userId.toString()));

    return next ? next.userId : null;
};