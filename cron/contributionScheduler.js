import cron from "node-cron";
import Group from "../models/groupModel.js";
import Contribution from "../models/contributionModel.js";
import Cycle from "../models/cycleModel.js";
import GroupMember from "../models/groupMemberModel.js";
import { pickCycleRecipient } from "../utils/pickCycleRecipient.js";
import { createNotification } from "../controllers/notificationController.js";

const addInterval = (date, frequency) => {
    const next = new Date(date);
    if (frequency === "weekly") next.setDate(next.getDate() + 7);
    else if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
    return next;
};

// Flips any DUE contribution whose dueDate has passed to OVERDUE, and alerts that
// group's organizer and the member who owes it once per contribution (not repeated
// every tick, since status only flips DUE -> OVERDUE once).
const flagOverdueContributions = async () => {
    const overdueContributions = await Contribution.find({
        status: "DUE",
        dueDate: { $lt: new Date() }
    });

    for (const contribution of overdueContributions) {
        try {
            contribution.status = "OVERDUE";
            await contribution.save();

            const group = await Group.findById(contribution.groupId);
            if (!group) continue;

            const amount = `₦${contribution.amount.toLocaleString("en-NG")}`;
            const related = { relatedModel: "Contribution", relatedId: contribution._id };

            // Member who owes it
            try {
                await createNotification(
                    contribution.memberId,
                    "OVERDUE_MEMBER_ALERT",
                    "Your contribution is overdue",
                    `Your contribution of ${amount} for "${group.groupName}" is now overdue. Please pay as soon as you can.`,
                    related
                );
            } catch (err) {
                console.error(`[cron] Member overdue notification failed (contribution ${contribution._id}):`, err);
            }

            // Organizer (skipped if the organizer is the one who owes it)
            if (String(group.organizerId) !== String(contribution.memberId)) {
                try {
                    await createNotification(
                        group.organizerId,
                        "OVERDUE_ORGANIZER_ALERT",
                        "A member's contribution is overdue",
                        `A contribution of ${amount} for "${group.groupName}" is now overdue.`,
                        related
                    );
                } catch (err) {
                    console.error(`[cron] Organizer overdue notification failed (contribution ${contribution._id}):`, err);
                }
            }
        } catch (err) {
            console.error(`[cron] Failed to flag contribution ${contribution._id} as overdue:`, err);
        }
    }

    if (overdueContributions.length > 0) {
        console.log(`[cron] Flagged ${overdueContributions.length} contribution(s) as OVERDUE.`);
    }
};

const processGroup = async (group) => {
    const lastContribution = await Contribution.findOne({ groupId: group._id })
        .sort({ dueDate: -1 });

    const nextDueDate = lastContribution
        ? addInterval(lastContribution.dueDate, group.frequency)
        : group.startDate;

    if (nextDueDate <= new Date()) {
        const lastCycle = await Cycle.findOne({ groupId: group._id }).sort({ cycleNumber: -1 });
        const nextCycleNumber = lastCycle ? lastCycle.cycleNumber + 1 : 1;

        const recipientId = await pickCycleRecipient(group._id);
        if (!recipientId) {
            console.log(`[cron] Group ${group._id}: everyone has already been paid, skipping cycle creation.`);
            return;
        }

        try {
            await Cycle.create({
                groupId: group._id,
                cycleNumber: nextCycleNumber,
                recipientId
            });
        } catch (err) {
            if (err.code === 11000) return; // cycle already exists, nothing to do
            throw err;
        }

        const activeMembers = await GroupMember.find({ groupId: group._id, status: "active" });
        const results = { created: 0, skipped: 0 };

        for (const member of activeMembers) {
            try {
                await Contribution.create({
                    groupId: group._id,
                    memberId: member.userId,
                    amount: group.contributionAmount,
                    dueDate: nextDueDate,
                    cycleNumber: nextCycleNumber
                });
                results.created++;
            } catch (err) {
                if (err.code === 11000) results.skipped++;
                else throw err;
            }
        }

        console.log(`[cron] Group ${group._id}: cycle ${nextCycleNumber} created, recipient ${recipientId}, contributions created ${results.created}, skipped ${results.skipped}`);
    }
};

let isRunning = false;

const runCycleCheck = async () => {
    console.log("[cron] Checking groups for due contribution cycles...");

    if (isRunning) return; // previous run still going
    isRunning = true;

    try {
        try {
            await flagOverdueContributions();
        } catch (err) {
            console.error("[cron] Overdue check failed:", err);
        }

        const activeGroups = await Group.find({ status: "active" });

        for (const group of activeGroups) {
            try {
                await processGroup(group);
            } catch (err) {
                console.error(`[cron] Group ${group._id} failed:`, err);
            }
        }
    } catch (err) {
        console.error("[cron] Cycle check failed:", err);
    } finally {
        isRunning = false;
    }
};

export const startContributionScheduler = () => {
    cron.schedule("* * * * *", runCycleCheck);
    console.log("[cron] Contribution scheduler started.");
};