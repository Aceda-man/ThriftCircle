import Contribution from "../models/contributionModel.js";
import GroupMember from "../models/groupMemberModel.js";
import Cycle from "../models/cycleModel.js";

// GET /groups/:groupId/dashboard/organizer — requires isGroupOrganizer to have run first
export const getOrganizerDashboard = async (req, res) => {
    try {
        const { groupId } = req.params;

        const [
            memberCount,
            activeCycle,
            confirmedCount,
            outstandingCount,
            pendingReview,
            issueCount
        ] = await Promise.all([
            GroupMember.countDocuments({ groupId, status: "active" }),
            Cycle.findOne({ groupId, status: { $in: ["ACTIVE", "PAYOUT_PHASE"] } }),
            Contribution.countDocuments({ groupId, status: "CONFIRMED" }),
            Contribution.countDocuments({ groupId, status: { $in: ["DUE", "OVERDUE"] } }),
            Contribution.countDocuments({ groupId, status: "PENDING_REVIEW" }),
            Contribution.countDocuments({ groupId, status: "ISSUE" })
        ]);

        let cycleSummary = null;
        if (activeCycle) {
            const cycleConfirmed = await Contribution.countDocuments({
                groupId,
                cycleNumber: activeCycle.cycleNumber,
                status: "CONFIRMED"
            });
            cycleSummary = {
                cycleNumber: activeCycle.cycleNumber,
                cycleStatus: activeCycle.status,
                recipientId: activeCycle.recipientId,
                confirmed: cycleConfirmed,
                total: memberCount
            };
        }

        res.status(200).json({
            memberCount,
            currentCycle: cycleSummary,
            confirmedContributions: confirmedCount,
            outstandingContributions: outstandingCount,
            awaitingVerification: pendingReview,
            paymentIssues: issueCount
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /groups/:groupId/dashboard/member — requires isGroupMember to have run first
export const getMemberDashboard = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        const currentContribution = await Contribution.findOne({
            groupId,
            memberId: userId,
            status: { $in: ["DUE", "OVERDUE", "PENDING_REVIEW"] }
        }).sort({ dueDate: 1 });

        const [confirmedCount, outstandingCount, membership] = await Promise.all([
            Contribution.countDocuments({ groupId, memberId: userId, status: "CONFIRMED" }),
            Contribution.countDocuments({ groupId, memberId: userId, status: { $in: ["DUE", "OVERDUE"] } }),
            GroupMember.findOne({ groupId, userId })
        ]);

        const activeCycle = await Cycle.findOne({ groupId, status: { $in: ["ACTIVE", "PAYOUT_PHASE"] } });
        const cycleTotalConfirmed = activeCycle
            ? await Contribution.countDocuments({ groupId, cycleNumber: activeCycle.cycleNumber, status: "CONFIRMED" })
            : null;
        const cycleTotalMembers = activeCycle
            ? await GroupMember.countDocuments({ groupId, status: "active" })
            : null;

        res.status(200).json({
            currentContribution,
            confirmedCount,
            outstandingCount,
            payoutOrder: membership ? membership.payoutOrder : null,
            isNextRecipient: activeCycle ? activeCycle.recipientId.equals(userId) : false,
            cycleProgress: activeCycle
                ? {
                    cycleNumber: activeCycle.cycleNumber,
                    cycleStatus: activeCycle.status,
                    confirmed: cycleTotalConfirmed,
                    total: cycleTotalMembers
                  }
                : null
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /groups/:groupId/outstanding — requires isGroupMember to have run first
export const getOutstandingContributions = async (req, res) => {
    try {
        const { groupId } = req.params;

        const filter = { groupId, status: { $in: ["DUE", "OVERDUE"] } };

        // Members only see their own; organizers see everyone's
        if (req.membership.role !== "organizer") {
            filter.memberId = req.user._id;
        }

        const outstanding = await Contribution.find(filter)
            .populate("memberId", "fullName email")
            .sort({ dueDate: 1 });

        res.status(200).json(outstanding);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /groups/:groupId/progress — visible to any member, no financial detail exposed
export const getGroupProgress = async (req, res) => {
    try {
        const { groupId } = req.params;

        const activeCycle = await Cycle.findOne({ groupId, status: { $in: ["ACTIVE", "PAYOUT_PHASE"] } });
        if (!activeCycle) {
            return res.status(200).json({ message: "No active cycle.", confirmed: 0, total: 0 });
        }

        const [confirmed, total] = await Promise.all([
            Contribution.countDocuments({ groupId, cycleNumber: activeCycle.cycleNumber, status: "CONFIRMED" }),
            GroupMember.countDocuments({ groupId, status: "active" })
        ]);

        res.status(200).json({
            cycleNumber: activeCycle.cycleNumber,
            cycleStatus: activeCycle.status,
            confirmed,
            total,
            summary: `${confirmed} of ${total} contributions confirmed`
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};