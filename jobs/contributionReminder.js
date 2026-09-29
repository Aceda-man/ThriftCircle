import Contribution from "../models/contributionModel.js";
import GroupMember from "../models/groupMemberModel.js";
import { createNotification } from "../controllers/notificationController.js";
import { reminderRules } from "../config/notificationRules.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Due dates are stored as midnight UTC, so all day-window maths is done in UTC.
const startOfUtcDay = (date = new Date()) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const formatAmount = (amount) => `₦${Number(amount).toLocaleString("en-NG")}`;
const whenText = (days) => (days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`);

// DUE → OVERDUE once the due day has fully passed with no submission
export const flagOverdueContributions = async (todayStart) => {
    const result = await Contribution.updateMany(
        { status: "DUE", dueDate: { $lt: todayStart } },
        { $set: { status: "OVERDUE" } }
    );
    return result.modifiedCount;
};

// Member reminder: contribution coming up
export const sendUpcomingReminders = async (todayStart) => {
    let sent = 0;

    for (const daysBefore of reminderRules.upcomingDaysBefore) {
        const windowStart = new Date(todayStart.getTime() + daysBefore * DAY_MS);
        const windowEnd = new Date(windowStart.getTime() + DAY_MS);

        const contributions = await Contribution.find({
            status: "DUE",
            dueDate: { $gte: windowStart, $lt: windowEnd }
        }).populate("groupId", "groupName");

        for (const contribution of contributions) {
            const groupName = contribution.groupId?.groupName ?? "your group";
            const title = daysBefore === 0 ? "Contribution due today" : "Contribution coming up";
            const message = `Your ${formatAmount(contribution.amount)} contribution to ${groupName} is due ${whenText(daysBefore)}.`;

            await createNotification(contribution.memberId, title, message);
            sent++;
        }
    }

    return sent;
};

// Member reminder: contribution overdue. On the last configured day, also alerts organizers.
export const sendOverdueReminders = async (todayStart) => {
    const reminderDays = reminderRules.overdueReminderDays;
    const lastReminderDay = Math.max(...reminderDays);
    let sent = 0;

    for (const daysLate of reminderDays) {
        const windowStart = new Date(todayStart.getTime() - daysLate * DAY_MS);
        const windowEnd = new Date(windowStart.getTime() + DAY_MS);

        const contributions = await Contribution.find({
            status: "OVERDUE",
            dueDate: { $gte: windowStart, $lt: windowEnd }
        })
            .populate("groupId", "groupName")
            .populate("memberId", "fullName");

        for (const contribution of contributions) {
            if (!contribution.groupId || !contribution.memberId) continue;

            const groupName = contribution.groupId.groupName;
            const memberMessage = `Your ${formatAmount(contribution.amount)} contribution to ${groupName} is ${daysLate} ${daysLate === 1 ? "day" : "days"} overdue.`;

            await createNotification(contribution.memberId._id, "Contribution overdue", memberMessage);
            sent++;

            if (daysLate === lastReminderDay) {
                const organizers = await GroupMember.find({
                    groupId: contribution.groupId._id,
                    role: "organizer",
                    status: "active"
                });

                for (const organizer of organizers) {
                    if (organizer.userId.equals(contribution.memberId._id)) continue;

                    const orgMessage = `${contribution.memberId.fullName} is ${daysLate} days overdue on ${formatAmount(contribution.amount)} for ${groupName}.`;
                    await createNotification(organizer.userId, "Member still overdue", orgMessage);
                    sent++;
                }
            }
        }
    }

    return sent;
};

// NOTE: this runs once daily via jobs/scheduler.js. There's no duplicate-guard field
// on the notification model anymore, so this only stays duplicate-free as long as the
// job runs once per day. Running jobs/runOnce.js manually more than once on the same
// day WILL create duplicate notifications — fine for now, revisit if that becomes a problem.
export const runContributionReminders = async () => {
    const todayStart = startOfUtcDay();

    const flagged = await flagOverdueContributions(todayStart);
    const upcoming = await sendUpcomingReminders(todayStart);
    const overdue = await sendOverdueReminders(todayStart);

    console.log(`[reminders] flagged ${flagged} as overdue; sent ${upcoming} upcoming and ${overdue} overdue notifications`);
    return { flagged, upcoming, overdue };
};