import cron from "node-cron";
import Group from "../models/groupModel.js";
import Contribution from "../models/contributionModel.js";
import Cycle from "../models/cycleModel.js";
import { generateContributionsForGroup } from "../controllers/contributionController.js";

const addInterval = (date, frequency) => {
    const next = new Date(date);
    if (frequency === "weekly") next.setDate(next.getDate() + 7);
    else if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
    return next;
};

//step A - Checks and closes the cycle once everyone pays
export const checkAndCloseCycle = async (groupId) => {
    try {
        const activeCycle = await Cycle.findOne({ groupId, status: "ACTIVE" });
        if (!activeCycle) return;

        const group = await Group.findById(groupId);
        if (!group) return;

        const totalGroupMembers = group.members.length;

        // checks how many contributions are CONFIRMED for this round
        const confirmedCount = await Contribution.countDocuments({
            groupId,
            round: activeCycle.cycleNumber,
            status: "CONFIRMED"
        });

        // If everyone has paid up, cycle closes
        if (confirmedCount === totalGroupMembers) {
            activeCycle.status = "COMPLETED";
            await activeCycle.save();
            console.log(`[Cycle Engine] Group ${groupId}: Cycle ${activeCycle.cycleNumber} marked COMPLETED.`);

            // Move the turn index pointer forward in the payout order
            const currentTurnIndex = group.payout_order.findIndex(
                (id) => id.toString() === activeCycle.recipientId.toString()
            );
            const nextTurnIndex = currentTurnIndex + 1;

            if (nextTurnIndex < group.payout_order.length) {
                // If there's a next person in line, update 
                group.currentPayoutTurnIndex = nextTurnIndex;
                group.currentRound = activeCycle.cycleNumber + 1;
                await group.save();
                
                console.log(`[Cycle Engine] Group ${groupId} turn index advanced to slot ${nextTurnIndex}.`);
            } else {
                // All members have drawn their cash, finish the system loop entirely
                group.status = "completed";
                await group.save();
                console.log(`[Cycle Engine] Group ${groupId} has completed all designated contribution sequences.`);
            }
        }
    } catch (error) {
        console.error("[Cycle Engine Error] Error executing checkAndCloseCycle loop:", error.message);
    }
};

// Step B: Automatically execute cycle checks daily
const runCycleCheck = async () => {
    console.log("[cron] Checking groups for due contribution cycles...");
    const activeGroups = await Group.find({ status: "active" });

    for (const group of activeGroups) {
        const lastContribution = await Contribution.findOne({ groupId: group._id })
            .sort({ dueDate: -1 });

        const nextDueDate = lastContribution
            ? addInterval(lastContribution.dueDate, group.frequency)
            : group.startDate;

        if (nextDueDate <= new Date()) {
            const incomingCycleNumber = lastContribution ? (lastContribution.round || 1) + 1 : 1;
            
            // Check for existing records to prevent duplication overlays
            const cycleExists = await Cycle.findOne({ groupId: group._id, cycleNumber: incomingCycleNumber });

            if (!cycleExists) {
                const turnIndex = group.currentPayoutTurnIndex || 0;
                const activeRecipientId = group.payout_order[turnIndex] || group.organizerId;

                // Create a tracking record for the new cycle
                await Cycle.create({
                    groupId: group._id,
                    cycleNumber: incomingCycleNumber,
                    status: "ACTIVE",
                    recipientId: activeRecipientId
                });
            }

            const result = await generateContributionsForGroup(
                group._id,
                group.contributionAmount,
                nextDueDate
            );
            console.log(`[cron] Group ${group._id}: created ${result.created}, skipped ${result.skipped}`);
        }
    }
};

export const startContributionScheduler = () => {
    cron.schedule("0 0 * * *", runCycleCheck);
    console.log("[cron] Contribution scheduler started.");
};