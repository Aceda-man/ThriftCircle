import Contribution from "../models/contributionModel.js";
import PaymentEvidence from "../models/paymentEvidenceModel.js";
import GroupMember from "../models/groupMemberModel.js";

// GET /groups/:groupId/contributions — requires isGroupMember to have run first
export const listGroupContributions = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { status, memberId } = req.query;

        const filter = { groupId };

        if (status) {
            filter.status = status;
        }

        // Only organizers can look at another member's contributions.
        // A plain member's query always narrows to their own records, regardless
        // of what memberId they try to pass — don't trust the query param for that.
        if (req.membership.role === "organizer") {
            if (memberId) {
                filter.memberId = memberId;
            }
            // no memberId → organizer sees the whole group's contributions
        } else {
            filter.memberId = req.user._id;
        }

        const contributions = await Contribution.find(filter).sort({ dueDate: -1 });

        res.status(200).json(contributions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /contributions/:contributionId — requires canAccessContribution to have run first
export const getContributionById = async (req, res) => {
    try {
        const contribution = req.contribution;

        const evidence = await PaymentEvidence.find({ contributionId: contribution._id })
            .sort({ createdAt: -1 });

        res.status(200).json({
            ...contribution.toObject(),
            evidence
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /groups/:groupId/contributions — organizer-only, creates a single DUE contribution for one member
export const createContribution = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { memberId, amount, dueDate } = req.body;

        if (!memberId || amount === undefined || !dueDate) {
            return res.status(400).json({ message: "memberId, amount, and dueDate are required." });
        }

        // Caller must be an active organizer of this group
        const callerMembership = await GroupMember.findOne({
            groupId,
            userId: req.user._id,
            status: "active",
            role: "organizer"
        });
        if (!callerMembership) {
            return res.status(403).json({ message: "Only an organizer can create contributions for this group." });
        }

        // Target member must actually be an active member of this group
        const targetMembership = await GroupMember.findOne({
            groupId,
            userId: memberId,
            status: "active"
        });
        if (!targetMembership) {
            return res.status(404).json({ message: "That user is not an active member of this group." });
        }

        const contribution = await Contribution.create({ groupId, memberId, amount, dueDate });

        res.status(201).json(contribution);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: "A contribution for this member and due date already exists." });
        }
        res.status(500).json({ message: err.message });
    }
};


// Creates a DUE contribution for every active member of a group, for a given dueDate.
// Skips members who already have one for that date (relies on the unique index).
export const generateContributionsForGroup = async (groupId, amount, dueDate) => {
    const activeMembers = await GroupMember.find({ groupId, status: "active" });

    const results = { created: 0, skipped: 0 };

    for (const member of activeMembers) {
        try {
            await Contribution.create({
                groupId,
                memberId: member.userId,
                amount,
                dueDate
            });
            results.created++;
        } catch (err) {
            if (err.code === 11000) {
                results.skipped++; // already exists for this member+date, fine
            } else {
                throw err; // real error, let it bubble up
            }
        }
    }

    return results;
}; // a round of applause