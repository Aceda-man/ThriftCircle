const addInterval = (date, frequency) => {
    const next = new Date(date);
    if (frequency === "weekly") next.setDate(next.getDate() + 7);
    else if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
    return next;
};

// Returns an error message if the schedule doesn't make sense, or null if it's fine.
export const validateGroupSchedule = ({ frequency, startDate, contributionDeadline }) => {
    if (!["weekly", "monthly"].includes(frequency)) {
        return "frequency must be weekly or monthly.";
    }

    const start = new Date(startDate);
    const deadline = new Date(contributionDeadline);

    if (Number.isNaN(start.getTime()) || Number.isNaN(deadline.getTime())) {
        return "startDate and contributionDeadline must be valid dates.";
    }

    if (deadline <= start) {
        return "contributionDeadline must be after startDate.";
    }

    // The payment window must be shorter than one cycle, or a cycle would
    // still be open for payment when the next one starts.
    if (deadline >= addInterval(start, frequency)) {
        return `The payment window (startDate to contributionDeadline) must be shorter than one ${frequency === "weekly" ? "week" : "month"}.`;
    }

    return null;
};