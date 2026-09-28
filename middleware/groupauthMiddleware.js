import GroupMember from "../models/groupMemberModel.js";
import Group from "../models/groupModel.js";
import Payout from "../models/payoutModel.js";


const resolveGroupId = (req) => req.params.groupId || req.body.groupId;

// Caller must have an active GroupMember record for this group (any role).
// Use for: viewing group details, viewing contributions, general group access.
export const isGroupMember = async (req, res, next) => {
    try {
        const groupId = resolveGroupId(req);
        if (!groupId) {
            return res.status(400).json({ message: "groupId is required." });
        }

        const membership = await GroupMember.findOne({
            userId: req.user._id,
            groupId,
            status: "active"
        });

        if (!membership) {
            return res.status(403).json({ message: "You are not a member of this group." });
        }

        req.membership = membership;
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Caller must be an "organizer" on this specific group (multiple organizers allowed).
// Use for: reviewing payment evidence.
export const isGroupOrganizer = async (req, res, next) => {
    try {
        const groupId = resolveGroupId(req);
        if (!groupId) {
            return res.status(400).json({ message: "groupId is required." });
        }

        const membership = await GroupMember.findOne({
            userId: req.user._id,
            groupId,
            status: "active",
            role: "organizer"
        });

        if (!membership) {
            return res.status(403).json({ message: "Only group organizers can perform this action." });
        }

        req.membership = membership;
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Caller must be the single designated creator of this group (Group.organizerId).
// Use for group-scoped routes where groupId IS available directly (params/body) —
// e.g. /groups/:groupId/settings.
export const isGroupCreator = async (req, res, next) => {
    try {
        const groupId = resolveGroupId(req);
        if (!groupId) {
            return res.status(400).json({ message: "groupId is required." });
        }

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: "Group not found." });
        }

        if (!group.organizerId.equals(req.user._id)) {
            return res.status(403).json({ message: "Only the group creator can perform this action." });
        }

        req.group = group;
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Caller must be the group creator for the group a SPECIFIC PAYOUT belongs to.
// Use for: /payouts/:payoutId/approve — where groupId isn't in the URL/body at all,
// so it's derived from the payout record itself rather than trusted from the request.
export const isPayoutGroupCreator = async (req, res, next) => {
    try {
        const payout = await Payout.findById(req.params.payoutId);
        if (!payout) {
            return res.status(404).json({ message: "Payout not found." });
        }

        const group = await Group.findById(payout.groupId);
        if (!group) {
            return res.status(404).json({ message: "Group not found." });
        }

        if (!group.organizerId.equals(req.user._id)) {
            return res.status(403).json({ message: "Only the group creator can perform this action." });
        }

        req.payout = payout;
        req.group = group;
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};