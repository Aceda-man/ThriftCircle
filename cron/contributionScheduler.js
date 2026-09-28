import cron from "node-cron";
import Group from "../models/groupModel.js";
import Contribution from "../models/contributionModel.js";
import { generateContributionsForGroup } from "../controllers/contributionController.js";

const addInterval = (date, frequency) => {
    const next = new Date(date);
    if (frequency === "weekly") next.setDate(next.getDate() + 7);
    else if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
    return next;
};

const runCycleCheck = async () => {
    console.log("[cron] Checking groups for due contribution cycles...");
    const activeGroups = await Group.find({ status: "active" });

    for (const group of activeGroups) {
        const lastContribution = await Contribution.findOne({ groupId: group._id })
            .sort({ dueDate: -1 });

        const nextDueDate = lastContribution
            ? addInterval(lastContribution.dueDate, group.frequency)
            : group.startDate; // no contributions yet — first cycle uses the group's startDate

        if (nextDueDate <= new Date()) {
            const result = await generateContributionsForGroup(
                group._id,
                group.contributionAmount,
                nextDueDate
            );
            console.log(`[cron] Group ${group._id}: created ${result.created}, skipped ${result.skipped}`);
        }
    }
};

// Runs once a day at midnight. For quick manual testing, temporarily swap to "* * * * *" (every minute).
export const startContributionScheduler = () => {
    cron.schedule("0 0 * * *", runCycleCheck);
    console.log("[cron] Contribution scheduler started.");
};