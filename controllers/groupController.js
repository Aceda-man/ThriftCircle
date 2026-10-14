import crypto from "crypto";
import Group from "../models/groupModel.js";
import GroupMember from "../models/groupMemberModel.js";
import Cycle from "../models/cycleModel.js";
import Contribution from "../models/contributionModel.js";
import { createNotification } from "./notificationController.js";
import { getRulesForGroup } from "../utils/getGroupRules.js";
import { logAudit } from "../utils/logAudit.js";
import { validateGroupSchedule } from "../utils/validateGroupSchedule.js";

const generateInviteCode = () =>
  crypto.randomBytes(3).toString("hex").toUpperCase();

// Turns database errors into clear 400s instead of a vague 500.
const sendError = (res, err) => {
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({
      message: errors.map((e) => e.message).join(" "),
      errors,
    });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ message: `Invalid value for ${err.path}.` });
  }
  return res.status(500).json({ message: err.message });
};

// Accepts 5000, "5000", "5,000" or "₦5,000".
const parseAmount = (value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replace(/[₦,\s]/g, ""));
  return NaN;
};

// Retries with a new invite code in the rare case two groups get the same one.
const createGroupWithUniqueCode = async (data) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await Group.create({ ...data, inviteCode: generateInviteCode() });
    } catch (err) {
      const isCodeClash =
        err.code === 11000 && err.keyPattern && err.keyPattern.inviteCode;
      if (!isCodeClash) throw err;
    }
  }
  throw new Error("Could not generate a unique invite code. Please try again.");
};

// POST /groups — organizer creates a new group
export const createGroup = async (req, res) => {
  try {
    const raw = req.body ?? {};

    const groupName =
      typeof raw.groupName === "string" ? raw.groupName.trim() : raw.groupName;
    const frequency =
      typeof raw.frequency === "string"
        ? raw.frequency.trim().toLowerCase()
        : raw.frequency;
    const { contributionAmount, startDate, contributionDeadline } = raw;

    // Tell the client exactly which fields are missing
    const missing = Object.entries({
      groupName,
      contributionAmount,
      frequency,
      startDate,
      contributionDeadline,
    })
      .filter(([, v]) => v === undefined || v === null || v === "")
      .map(([k]) => k);

    if (missing.length) {
      return res.status(400).json({
        message: `Missing required fields: ${missing.join(", ")}.`,
        missing,
      });
    }

    if (typeof groupName !== "string") {
      return res.status(400).json({ message: "groupName must be text." });
    }

    const amount = parseAmount(contributionAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        message: "contributionAmount must be a number greater than 0.",
      });
    }

    const scheduleError = validateGroupSchedule({
      frequency,
      startDate,
      contributionDeadline,
    });
    if (scheduleError) {
      return res.status(400).json({ message: scheduleError });
    }

    const group = await createGroupWithUniqueCode({
      groupName,
      organizerId: req.user._id,
      contributionAmount: amount,
      frequency,
      startDate,
      contributionDeadline,
      status: "active",
    });

    try {
      await GroupMember.create({
        userId: req.user._id,
        groupId: group._id,
        joinedAt: new Date(),
        status: "active",
        role: "organizer",
        payoutOrder: 1,
      });
    } catch (err) {
      // Don't leave a group with no organizer behind.
      await Group.deleteOne({ _id: group._id });
      throw err;
    }

    await logAudit({
      groupId: group._id,
      actorId: req.user._id,
      action: "GROUP_CREATED",
      targetModel: "Group",
      targetId: group._id,
      metadata: { groupName, contributionAmount: amount, frequency },
    });

    res.status(201).json(group);
  } catch (err) {
    sendError(res, err);
  }
};

// POST /groups/join — a user requests to join a group via invite code.
// Creates a PENDING membership — not active until the organizer approves it.
export const joinGroup = async (req, res) => {
  try {
    const raw = req.body ?? {};
    const inviteCode =
      typeof raw.inviteCode === "string"
        ? raw.inviteCode.trim().toUpperCase()
        : "";

    if (!inviteCode) {
      return res.status(400).json({ message: "inviteCode is required." });
    }

    const group = await Group.findOne({ inviteCode });
    if (!group) {
      return res.status(404).json({ message: "Invalid invite code." });
    }

    const existingMembership = await GroupMember.findOne({
      groupId: group._id,
      userId: req.user._id,
    });
    if (existingMembership) {
      const messages = {
        pending: "Your request to join is already pending approval.",
        removed: "Your previous request to join this group was declined.",
      };
      return res.status(409).json({
        message:
          messages[existingMembership.status] ||
          "You are already a member of this group.",
      });
    }

    const membership = await GroupMember.create({
      userId: req.user._id,
      groupId: group._id,
      joinedAt: null, // not set until approved
      status: "pending",
      role: "member",
      payoutOrder: null, // assigned on approval, not on request
    });

    await logAudit({
      groupId: group._id,
      actorId: req.user._id,
      action: "MEMBER_REQUESTED",
      targetModel: "GroupMember",
      targetId: membership._id,
    });

    await createNotification(
      group.organizerId,
      "GROUP_JOIN_REQUEST",
      "New join request",
      `Someone requested to join "${group.groupName}" — awaiting your approval.`,
      { relatedModel: "Group", relatedId: group._id },
    );

    res.status(201).json({
      message: "Join request sent. Awaiting organizer approval.",
      membership,
    });
  } catch (err) {
    sendError(res, err);
  }
};

// PATCH /groups/:groupId/members/:userId/approve — organizer approves a pending request.
// Requires isGroupOrganizer to have run first.
export const approveMember = async (req, res) => {
  try {
    const { groupId, userId } = req.params;

    const membership = await GroupMember.findOne({ groupId, userId });
    if (!membership) {
      return res
        .status(404)
        .json({ message: "No membership request found for this user." });
    }
    if (membership.status !== "pending") {
      return res.status(409).json({
        message: `This membership is not pending (status: ${membership.status}).`,
      });
    }

    const activeCount = await GroupMember.countDocuments({
      groupId,
      status: "active",
    });

    const rules = await getRulesForGroup(groupId);
    if (rules.maxMembers !== null && activeCount >= rules.maxMembers) {
      return res
        .status(409)
        .json({ message: `This group is full (${rules.maxMembers} members).` });
    }

    membership.status = "active";
    membership.joinedAt = new Date();

    const highest = await GroupMember.findOne({ groupId, status: "active" })
      .sort({ payoutOrder: -1 })
      .select("payoutOrder");
    membership.payoutOrder = (highest?.payoutOrder || 0) + 1;

    await membership.save();

    await logAudit({
      groupId,
      actorId: req.user._id,
      action: "MEMBER_APPROVED",
      targetModel: "GroupMember",
      targetId: membership._id,
      metadata: { memberUserId: userId, payoutOrder: membership.payoutOrder },
    });

    const group = await Group.findById(groupId);

    // Backfill: if a cycle is already in progress, the newly-approved member
    // owes a contribution for it too. Uses the newest open cycle.
    let backfilledContribution = null;
    const activeCycle = await Cycle.findOne({
      groupId,
      status: { $in: ["ACTIVE", "PAYOUT_PHASE"] },
    }).sort({ cycleNumber: -1 });

    if (activeCycle && group) {
      const sampleContribution = await Contribution.findOne({
        groupId,
        cycleNumber: activeCycle.cycleNumber,
      });

      if (sampleContribution) {
        const existingContribution = await Contribution.findOne({
          groupId,
          memberId: userId,
          cycleNumber: activeCycle.cycleNumber,
        });

        if (!existingContribution) {
          backfilledContribution = await Contribution.create({
            groupId,
            memberId: userId,
            amount: group.contributionAmount,
            dueDate: sampleContribution.dueDate,
            cycleNumber: activeCycle.cycleNumber,
          });
        }
      }
    }

    await createNotification(
      userId,
      "GROUP_INVITE",
      "Join request approved",
      `Your request to join "${group ? group.groupName : "the group"}" was approved.`,
      { relatedModel: "Group", relatedId: groupId },
    );

    res.status(200).json({ membership, backfilledContribution });
  } catch (err) {
    sendError(res, err);
  }
};

// PATCH /groups/:groupId/members/:userId/reject — organizer rejects a pending request.
// Requires isGroupOrganizer to have run first.
export const rejectMember = async (req, res) => {
  try {
    const { groupId, userId } = req.params;

    const membership = await GroupMember.findOne({ groupId, userId });
    if (!membership) {
      return res
        .status(404)
        .json({ message: "No membership request found for this user." });
    }
    if (membership.status !== "pending") {
      return res.status(409).json({
        message: `This membership is not pending (status: ${membership.status}).`,
      });
    }

    membership.status = "removed";
    await membership.save();

    await logAudit({
      groupId,
      actorId: req.user._id,
      action: "MEMBER_REJECTED",
      targetModel: "GroupMember",
      targetId: membership._id,
      metadata: { memberUserId: userId },
    });

    const group = await Group.findById(groupId);
    await createNotification(
      userId,
      "JOIN_REQUEST_REJECTED",
      "Join request declined",
      `Your request to join "${group ? group.groupName : "the group"}" was declined.`,
      { relatedModel: "Group", relatedId: groupId },
    );

    res.status(200).json({ message: "Join request rejected." });
  } catch (err) {
    sendError(res, err);
  }
};

// GET /groups/mine — groups the caller belongs to (active memberships only), with their role in each
export const getMyGroups = async (req, res) => {
  try {
    const memberships = await GroupMember.find({
      userId: req.user._id,
      status: "active",
    }).populate("groupId");

    const groups = memberships
      .filter((m) => m.groupId) // skip memberships whose group no longer exists
      .map((m) => ({
        ...m.groupId.toObject(),
        role: m.role,
        joinedAt: m.joinedAt,
      }));

    res.status(200).json(groups);
  } catch (err) {
    sendError(res, err);
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
      callerRole: req.membership.role,
    });
  } catch (err) {
    sendError(res, err);
  }
};

// GET /groups/:groupId/pending — organizer views pending join requests.
// Requires isGroupOrganizer to have run first.
export const getPendingMembers = async (req, res) => {
  try {
    const { groupId } = req.params;

    const pending = await GroupMember.find({
      groupId,
      status: "pending",
    }).populate("userId", "fullName email phoneNumber");

    res.status(200).json(pending);
  } catch (err) {
    sendError(res, err);
  }
};