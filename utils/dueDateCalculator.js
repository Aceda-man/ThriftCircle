// All dates are handled in UTC, since Group.startDate / Contribution.dueDate
// are stored as midnight UTC (e.g. "2026-10-01" -> 2026-10-01T00:00:00Z).

const startOfUtcDay = (date) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// Weekly: contributionDay is 0-6 (0 = Sunday), like Date.getUTCDay().
// Returns the next occurrence of that weekday ON OR AFTER `from`.
const nextWeekday = (from, contributionDay) => {
    const date = startOfUtcDay(from);
    const currentDay = date.getUTCDay();
    const daysToAdd = (contributionDay - currentDay + 7) % 7;
    date.setUTCDate(date.getUTCDate() + daysToAdd);
    return date;
};

// Monthly: contributionDay is 1-28. Returns that day in `from`'s month if it's
// still ahead of `from`; otherwise the same day next month. A day that would
// overflow a short month pushes to the 1st of the FOLLOWING month.
const nextMonthlyDate = (from, contributionDay) => {
    const date = startOfUtcDay(from);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();

    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    let candidate;
    if (contributionDay > daysInMonth) {
        candidate = new Date(Date.UTC(year, month + 1, 1));
    } else {
        candidate = new Date(Date.UTC(year, month, contributionDay));
    }

    if (candidate < date) {
        const nextMonthDays = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
        candidate = contributionDay > nextMonthDays
            ? new Date(Date.UTC(year, month + 2, 1))
            : new Date(Date.UTC(year, month + 1, contributionDay));
    }

    return candidate;
};

// Computes the due date for `cycleNumber` (1-indexed) of a group.
// anchorDate = the group's startDate. frequency = "daily" | "weekly" | "monthly".
// contributionDay: ignored for daily; 0-6 for weekly; 1-28 for monthly.
export const getDueDateForCycle = (anchorDate, frequency, contributionDay, cycleNumber) => {
    const anchor = startOfUtcDay(new Date(anchorDate));

    if (frequency === "daily") {
        const date = new Date(anchor);
        date.setUTCDate(date.getUTCDate() + (cycleNumber - 1));
        return date;
    }

    if (frequency === "weekly") {
        let date = nextWeekday(anchor, contributionDay);
        for (let i = 1; i < cycleNumber; i++) {
            const next = new Date(date);
            next.setUTCDate(next.getUTCDate() + 1);
            date = nextWeekday(next, contributionDay);
        }
        return date;
    }

    if (frequency === "monthly") {
        let date = nextMonthlyDate(anchor, contributionDay);
        for (let i = 1; i < cycleNumber; i++) {
            const next = new Date(date);
            next.setUTCDate(next.getUTCDate() + 1);
            date = nextMonthlyDate(next, contributionDay);
        }
        return date;
    }

    throw new Error(`Unknown frequency: ${frequency}`);
};