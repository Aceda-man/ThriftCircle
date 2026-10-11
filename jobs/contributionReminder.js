import "../models/groupModel.js";
import "../models/userModel.js";
import Contribution from "../models/contributionModel.js";
import GroupMember from "../models/groupMemberModel.js";
import Notification from "../models/notificationModel.js";
import { createNotification } from "../controllers/notificationController.js";
import { reminderRules } from "../config/notificationRules.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Due dates are compared by UTC day, so all day-window maths is done in UTC.
const startOfUtcDay = (date = new Date()) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const formatAmount = (amount) => `₦${Number(amount).toLocaleString("en-NG")}`;
const whenText = (days) => (days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`);

// Sends at most one notification per recipient, type and contribution per UTC day,
// so re-running the job (e.g. runOnce.js) or overlapping with cron doesn't duplicate.
// Returns true only if a notification was actually created.
const sendOncePerDay = async (todayStart, { recipientId, type, title, message, relatedId }) => {
    const alreadySent = await Notification.exists({
        recipientId,
        type,
        relatedId,
        createdAt: { $gte: todayStart }
    });
    if (alreadySent) return false;

    const created = await createNotification(recipientId, type, title, message, {
        relatedModel: "Contribution",
        relatedId
    });
    return Boolean(created);
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

            const ok = await sendOncePerDay(todayStart, {
                recipientId: contribution.memberId,
                type: "CONTRIBUTION_DUE_SOON",
                title: daysBefore === 0 ? "Contribution due today" : "Contribution coming up",
                message: `Your ${formatAmount(contribution.amount)} contribution to ${groupName} is due ${whenText(daysBefore)}.`,
                relatedId: contribution._id
            });
            if (ok) sent++;
        }
    }

    return sent;
};

// Member reminder: contribution overdue. On the last configured day, also alerts organizers.
// (Flagging DUE -> OVERDUE is done by cron/contributionScheduler.js, not here.)
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

            const memberOk = await sendOncePerDay(todayStart, {
                recipientId: contribution.memberId._id,
                type: "CONTRIBUTION_OVERDUE",
                title: "Contribution overdue",
                message: `Your ${formatAmount(contribution.amount)} contribution to ${groupName} is ${daysLate} ${daysLate === 1 ? "day" : "days"} overdue.`,
                relatedId: contribution._id
            });
            if (memberOk) sent++;

            if (daysLate === lastReminderDay) {
                const organizers = await GroupMember.find({
                    groupId: contribution.groupId._id,
                    role: "organizer",
                    status: "active"
                });

                for (const organizer of organizers) {
                    if (organizer.userId.equals(contribution.memberId._id)) continue;

                    const orgOk = await sendOncePerDay(todayStart, {
                        recipientId: organizer.userId,
                        type: "OVERDUE_ORGANIZER_ALERT",
                        title: "Member still overdue",
                        message: `${contribution.memberId.fullName} is ${daysLate} days overdue on ${formatAmount(contribution.amount)} for ${groupName}.`,
                        relatedId: contribution._id
                    });
                    if (orgOk) sent++;
                }
            }
        }
    }

    return sent;
};

export const runContributionReminders = async () => {
    const todayStart = startOfUtcDay();

    const upcoming = await sendUpcomingReminders(todayStart);
    const overdue = await sendOverdueReminders(todayStart);

    console.log(`[reminders] sent ${upcoming} upcoming and ${overdue} overdue notifications`);
    return { upcoming, overdue };
};