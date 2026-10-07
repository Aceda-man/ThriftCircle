import crypto from "crypto";
import Group from "../models/groupModel.js";
import GroupMember from "../models/groupMemberModel.js";
import Cycle from "../models/cycleModel.js";
import Contribution from "../models/contributionModel.js";
import { createNotification } from "./notificationController.js";

const generateInviteCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();

// POST /groups — organizer creates a new group
export const createGroup = async (req, res) => {
    try {
        const { groupName, contributionAmount, frequency, startDate, contributionDeadline } = req.body;

        if (!groupName || !contributionAmount || !frequency || !startDate || !contributionDeadline) {
            return res.status(400).json({ message: "All fields are required." });
        }

        const group = await Group.create({
            groupName,
            organizerId: req.user._id,
            contributionAmount,
            frequency,
            startDate,
            contributionDeadline,
            inviteCode: generateInviteCode(),
            status: "active"
        });

        await GroupMember.create({
            userId: req.user._id,
            groupId: group._id,
            joinedAt: new Date(),
            status: "active",
            role: "organizer",
            payoutOrder: 1
        });

        res.status(201).json(group);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /groups/join — a user requests to join a group via invite code.
// Creates a PENDING membership — not active until the organizer approves it.
export const joinGroup = async (req, res) => {
    try {
        const { inviteCode } = req.body;

        if (!inviteCode) {
            return res.status(400).json({ message: "inviteCode is required." });
        }

        const group = await Group.findOne({ inviteCode });
        if (!group) {
            return res.status(404).json({ message: "Invalid invite code." });
        }

        const existingMembership = await GroupMember.findOne({
            groupId: group._id,
            userId: req.user._id
        });
        if (existingMembership) {
            return res.status(409).json({
                message: existingMembership.status === "pending"
                    ? "Your request to join is already pending approval."
                    : "You are already a member of this group."
            });
        }

        const membership = await GroupMember.create({
            userId: req.user._id,
            groupId: group._id,
            joinedAt: null, // not set until approved
            status: "pending",
            role: "member",
            payoutOrder: null // assigned on approval, not on request
        });

        try {
            await createNotification(
                group.organizerId,
                "GROUP_JOIN_REQUEST",
                "New join request",
                `Someone requested to join "${group.groupName}" — awaiting your approval.`,
                { relatedModel: "Group", relatedId: group._id }
            );
        } catch (err) {
            console.error(`[joinGroup] Organizer notification failed (group ${group._id}):`, err);
        }

        res.status(201).json({ message: "Join request sent. Awaiting organizer approval.", membership });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PATCH /groups/:groupId/members/:userId/approve — organizer approves a pending request.
// Requires isGroupOrganizer to have run first.
export const approveMember = async (req, res) => {
    try {
        const { groupId, userId } = req.params;

        const membership = await GroupMember.findOne({ groupId, userId });
        if (!membership) {
            return res.status(404).json({ message: "No membership request found for this user." });
        }
        if (membership.status !== "pending") {
            return res.status(409).json({ message: `This membership is not pending (status: ${membership.status}).` });
        }

        const activeCount = await GroupMember.countDocuments({ groupId, status: "active" });

        membership.status = "active";
        membership.joinedAt = new Date();
        membership.payoutOrder = activeCount + 1;
        await membership.save();

        const group = await Group.findById(groupId);

        // Backfill: if a cycle is already in progress, the newly-approved member
        // owes a contribution for it too (same logic as before, just moved here).
        let backfilledContribution = null;
        const activeCycle = await Cycle.findOne({ groupId, status: "ACTIVE" });

        if (activeCycle && group) {
            const sampleContribution = await Contribution.findOne({
                groupId,
                cycleNumber: activeCycle.cycleNumber
            });

            if (sampleContribution) {
                const existingContribution = await Contribution.findOne({
                    groupId,
                    memberId: userId,
                    cycleNumber: activeCycle.cycleNumber
                });

                if (!existingContribution) {
                    backfilledContribution = await Contribution.create({
                        groupId,
                        memberId: userId,
                        amount: group.contributionAmount,
                        dueDate: sampleContribution.dueDate,
                        cycleNumber: activeCycle.cycleNumber
                    });
                }
            }
        }

        try {
            await createNotification(
                userId,
                "GROUP_INVITE",
                "Join request approved",
                `Your request to join "${group ? group.groupName : "the group"}" was approved.`,
                { relatedModel: "Group", relatedId: groupId }
            );
        } catch (err) {
            console.error(`[approveMember] Member notification failed (group ${groupId}):`, err);
        }

        res.status(200).json({ membership, backfilledContribution });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PATCH /groups/:groupId/members/:userId/reject — organizer rejects a pending request.
// Requires isGroupOrganizer to have run first.
export const rejectMember = async (req, res) => {
    try {
        const { groupId, userId } = req.params;

        const membership = await GroupMember.findOne({ groupId, userId });
        if (!membership) {
            return res.status(404).json({ message: "No membership request found for this user." });
        }
        if (membership.status !== "pending") {
            return res.status(409).json({ message: `This membership is not pending (status: ${membership.status}).` });
        }

        membership.status = "removed";
        await membership.save();

        res.status(200).json({ message: "Join request rejected." });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /groups/mine — groups the caller belongs to (active memberships only), with their role in each
export const getMyGroups = async (req, res) => {
    try {
        const memberships = await GroupMember.find({
            userId: req.user._id,
            status: "active"
        }).populate("groupId");

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

// GET /groups/:groupId — requires isGroupMember to have run first
export const getGroupDetails = async (req, res) => {
    try {
        const { groupId } = req.params;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: "Group not found." });
        }

        const members = await GroupMember.find({ groupId, status: "active" })
            .populate("userId", "fullName email phoneNumber")
            .sort({ payoutOrder: 1 });

        res.status(200).json({
            group,
            members,
            callerRole: req.membership.role
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /groups/:groupId/pending — organizer views pending join requests.
// Requires isGroupOrganizer to have run first.
export const getPendingMembers = async (req, res) => {
    try {
        const { groupId } = req.params;

        const pending = await GroupMember.find({ groupId, status: "pending" })
            .populate("userId", "fullName email phoneNumber");

        res.status(200).json(pending);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};