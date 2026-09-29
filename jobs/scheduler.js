import cron from "node-cron";
import { runContributionReminders } from "./contributionReminder.js";
import { reminderRules} from "../config/notificationRules.js";

export const startScheduler = () => {
    cron.schedule(
        reminderRules.cronExpression,
        async () => {
            try {
                await runContributionReminders();
            } catch (err) {
                console.error("[reminders] job failed:", err.message);
            }
        },
        { timezone: reminderRules.timezone }
    );

    console.log(`Scheduler started (reminders run "${reminderRules.cronExpression}" ${reminderRules.timezone})`);
};