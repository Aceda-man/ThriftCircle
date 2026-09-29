// Single place to change reminder timing. Values are proposals — confirm with the team.
export const reminderRules = {
    // Days BEFORE the due date to remind the member (0 = on the due date itself)
    upcomingDaysBefore: [3, 1, 0],

    // Days AFTER the due date to remind the member. Organizers are alerted on the LAST one.
    overdueReminderDays: [1, 3, 5],

    // Daily run time, in the timezone below
    cronExpression: "0 8 * * *",
    timezone: "Africa/Lagos"
};