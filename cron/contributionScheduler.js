import cron from "node-cron";
import Group from "../models/groupModel.js";
import Contribution from "../models/contributionModel.js";
import Cycle from "../models/cycleModel.js";
import GroupMember from "../models/groupMemberModel.js";
import { pickCycleRecipient } from "../utils/pickCycleRecipient.js";
import { createNotification } from "../controllers/notificationController.js";
import { getRulesForGroup } from "../utils/getGroupRules.js";

const addInterval = (date, frequency) => {
  const next = new Date(date);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  return next;
};

// Flips any DUE contribution whose dueDate has passed to OVERDUE, and notifies
// both the member who owes it and the group's organizer (unless the organizer
// is the one who owes it, in which case only the member notification fires).
const flagOverdueContributions = async () => {
  const pastDue = await Contribution.find({
    status: "DUE",
    dueDate: { $lt: new Date() },
  });

  const rulesCache = new Map(); // one rules lookup per group per run
  let flagged = 0;

  for (const contribution of pastDue) {
    try {
      const key = String(contribution.groupId);
      if (!rulesCache.has(key)) {
        rulesCache.set(key, await getRulesForGroup(contribution.groupId));
      }

      // Not overdue until the group's grace period has also passed
      const overdueAt = new Date(contribution.dueDate);
      overdueAt.setDate(
        overdueAt.getDate() + rulesCache.get(key).gracePeriodDays,
      );
      if (overdueAt > new Date()) continue;

      contribution.status = "OVERDUE";
      await contribution.save();
      flagged++;

      const group = await Group.findById(contribution.groupId);
      if (!group) continue;

      const amount = `₦${contribution.amount.toLocaleString("en-NG")}`;
      const related = {
        relatedModel: "Contribution",
        relatedId: contribution._id,
      };

      try {
        await createNotification(
          contribution.memberId,
          "CONTRIBUTION_OVERDUE",
          "Your contribution is overdue",
          `Your contribution of ${amount} for "${group.groupName}" is now overdue. Please pay as soon as you can.`,
          related,
        );
      } catch (err) {
        console.error(
          `[cron] Member overdue notification failed (contribution ${contribution._id}):`,
          err,
        );
      }

      if (String(group.organizerId) !== String(contribution.memberId)) {
        try {
          await createNotification(
            group.organizerId,
            "OVERDUE_ORGANIZER_ALERT",
            "A member's contribution is overdue",
            `A contribution of ${amount} for "${group.groupName}" is now overdue.`,
            related,
          );
        } catch (err) {
          console.error(
            `[cron] Organizer overdue notification failed (contribution ${contribution._id}):`,
            err,
          );
        }
      }
    } catch (err) {
      console.error(
        `[cron] Failed to flag contribution ${contribution._id} as overdue:`,
        err,
      );
    }
  }

  if (flagged > 0) {
    console.log(`[cron] Flagged ${flagged} contribution(s) as OVERDUE.`);
  }
};

const runCycleCheck = async () => {
  console.log("[cron] Checking groups for due contribution cycles...");

  await flagOverdueContributions();

  const activeGroups = await Group.find({ status: "active" });

  for (const group of activeGroups) {
    const lastContribution = await Contribution.findOne({
      groupId: group._id,
    }).sort({ dueDate: -1 });

    const nextDueDate = lastContribution
      ? addInterval(lastContribution.dueDate, group.frequency)
      : group.startDate;

    if (nextDueDate <= new Date()) {
      const lastCycle = await Cycle.findOne({ groupId: group._id }).sort({
        cycleNumber: -1,
      });
      const nextCycleNumber = lastCycle ? lastCycle.cycleNumber + 1 : 1;

      const recipientId = await pickCycleRecipient(group._id);
      if (!recipientId) {
        console.log(
          `[cron] Group ${group._id}: everyone has already been paid, skipping cycle creation.`,
        );
        continue;
      }

      await Cycle.create({
        groupId: group._id,
        cycleNumber: nextCycleNumber,
        recipientId,
      });

      const activeMembers = await GroupMember.find({
        groupId: group._id,
        status: "active",
      });
      const results = { created: 0, skipped: 0 };

      for (const member of activeMembers) {
        try {
          await Contribution.create({
            groupId: group._id,
            memberId: member.userId,
            amount: group.contributionAmount,
            dueDate: nextDueDate,
            cycleNumber: nextCycleNumber,
          });
          results.created++;
        } catch (err) {
          if (err.code === 11000) results.skipped++;
          else throw err;
        }
      }

      console.log(
        `[cron] Group ${group._id}: cycle ${nextCycleNumber} created, recipient ${recipientId}, contributions created ${results.created}, skipped ${results.skipped}`,
      );
    }
  }
};

export const startContributionScheduler = () => {
  cron.schedule("* * * * *", runCycleCheck); // switch back to "0 0 * * *" once confirmed working
  console.log("[cron] Contribution scheduler started.");
};
