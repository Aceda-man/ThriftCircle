import Group from "../models/groupModel.js";
import GroupMember from "../models/groupMemberModel.js";
import { generateInviteCode } from "../utils/generateInviteCode.js";

// POST /groups — create a group; caller becomes its creator AND an organizer member
export const createGroup = async (req, res) => {
    try {
        const { groupName, contributionAmount, frequency, startDate, contributionDeadline } = req.body;

        if (!groupName || !contributionAmount || !frequency || !startDate || !contributionDeadline) {
            return res.status(400).json({ message: "All fields are required." });
        }

        // Guard against a rare invite-code collision — retry a few times before giving up
        let inviteCode;
        let attempts = 0;
        while (attempts < 5) {
            const candidate = generateInviteCode();
            const existing = await Group.findOne({ inviteCode: candidate });
            if (!existing) {
                inviteCode = candidate;
                break;
            }
            attempts++;
        }
        if (!inviteCode) {
            return res.status(500).json({ message: "Could not generate a unique invite code, please try again." });
        }

        const group = await Group.create({
            groupName,
            organizerId: req.user._id,
            contributionAmount,
            frequency,
            startDate,
            contributionDeadline,
            inviteCode
        });

        // Creator is automatically an active organizer-level member of their own group
        await GroupMember.create({
            userId: req.user._id,
            groupId: group._id,
            role: "organizer",
            status: "active",
            joinedAt: new Date()
        });

        res.status(201).json(group);
    } catch (err) {
        if (err.name === "ValidationError") {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: err.message });
    }
};

// POST /groups/join — join an existing group via invite code
export const joinGroup = async (req, res) => {
    try {
        const { inviteCode } = req.body;

        if (!inviteCode) {
            return res.status(400).json({ message: "inviteCode is required." });
        }

        const group = await Group.findOne({ inviteCode: inviteCode.trim().toUpperCase() });
        if (!group) {
            return res.status(404).json({ message: "Invalid invite code." });
        }

        const existingMembership = await GroupMember.findOne({
            userId: req.user._id,
            groupId: group._id
        });

        if (existingMembership) {
            if (existingMembership.status === "active") {
                return res.status(409).json({ message: "You are already a member of this group." });
            }
            // Previously removed/pending — reactivate rather than create a duplicate record
            existingMembership.status = "active";
            existingMembership.joinedAt = new Date();
            await existingMembership.save();
            return res.status(200).json({ group, membership: existingMembership });
        }

        const membership = await GroupMember.create({
            userId: req.user._id,
            groupId: group._id,
            role: "member",
            status: "active",
            joinedAt: new Date()
        });

        res.status(200).json({ group, membership });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /groups/:groupId — full details, requires isGroupMember middleware to have run first
export const getGroupDetails = async (req, res) => {
    try {
        const group = req.group || (await Group.findById(req.params.groupId));
        if (!group) {
            return res.status(404).json({ message: "Group not found." });
        }

        const members = await GroupMember.find({ groupId: group._id, status: "active" })
            .populate("userId", "fullName email phoneNumber");

        res.status(200).json({
            group,
            members,
            callerRole: req.membership.role
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /groups/mine — every group the caller currently belongs to
export const getMyGroups = async (req, res) => {
    try {
        const memberships = await GroupMember.find({ userId: req.user._id, status: "active" })
            .populate("groupId");

        const groups = memberships.map((m) => ({
            ...m.groupId.toObject(),
            role: m.role,
            joinedAt: m.joinedAt
        }));

        res.status(200).json(groups);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};