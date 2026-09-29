import crypto from "crypto";
import Group from "../models/groupModel.js";
import GroupMember from "../models/groupMemberModel.js";
import Cycle from "../models/cycleModel.js";
import Contribution from "../models/contributionModel.js";

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

// POST /groups/join — a user joins a group via invite code
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
            return res.status(409).json({ message: "You are already a member of this group." });
        }

        const memberCount = await GroupMember.countDocuments({ groupId: group._id });

        const membership = await GroupMember.create({
            userId: req.user._id,
            groupId: group._id,
            joinedAt: new Date(),
            status: "active",
            role: "member",
            payoutOrder: memberCount + 1
        });

        // Backfill: if this group already has a cycle in progress, the late joiner
        // owes a contribution for it too — same dueDate and cycleNumber as everyone else.
        let backfilledContribution = null;
        const activeCycle = await Cycle.findOne({ groupId: group._id, status: "ACTIVE" });

        if (activeCycle) {
            const existingContribution = await Contribution.findOne({
                groupId: group._id,
                memberId: req.user._id,
                cycleNumber: activeCycle.cycleNumber
            });

            if (!existingContribution) {
                // Use the dueDate from any other contribution in this cycle, so it matches exactly.
                const sampleContribution = await Contribution.findOne({
                    groupId: group._id,
                    cycleNumber: activeCycle.cycleNumber
                });

                if (sampleContribution) {
                    backfilledContribution = await Contribution.create({
                        groupId: group._id,
                        memberId: req.user._id,
                        amount: group.contributionAmount,
                        dueDate: sampleContribution.dueDate,
                        cycleNumber: activeCycle.cycleNumber
                    });
                }
            }
        }

        res.status(201).json({ group, membership, backfilledContribution });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /groups/mine — groups the caller belongs to, with their role in each
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