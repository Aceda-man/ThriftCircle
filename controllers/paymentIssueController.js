import PaymentIssue from "../models/paymentIssueModel.js";
import Contribution from "../models/contributionModel.js";
import Group from "../models/groupModel.js";
import GroupMember from "../models/groupMemberModel.js";
import { createNotification } from "./notificationController.js";

const OPEN_STATUSES = ["REPORTED", "UNDER_REVIEW", "CORRECTION_REQUIRED"];

// POST /issues/report — the contribution's owner or a group organizer reports an issue.
// Requires protect to have run first.
export const reportIssue = async (req, res) => {
  try {
    const { contributionId, description } = req.body;

    if (!contributionId || !description || description.trim() === "") {
      return res.status(400).json({ message: "contributionId and description are required." });
    }

    const contribution = await Contribution.findById(contributionId);
    if (!contribution) {
      return res.status(404).json({ message: "Contribution not found." });
    }

    const isOwner = contribution.memberId.equals(req.user._id);
    let isOrganizer = false;

    if (!isOwner) {
      const membership = await GroupMember.findOne({
        userId: req.user._id,
        groupId: contribution.groupId,
        status: "active",
        role: "organizer",
      });
      if (membership) isOrganizer = true;
    }

    if (!isOwner && !isOrganizer) {
      return res.status(403).json({ message: "You are not authorized to report an issue for this contribution." });
    }

    if (contribution.status !== "PENDING_REVIEW") {
      return res.status(409).json({
        message: `An issue can only be reported on a contribution awaiting review (status: ${contribution.status}).`,
      });
    }

    const existingOpenIssue = await PaymentIssue.findOne({
      contributionId,
      status: { $in: OPEN_STATUSES },
    });
    if (existingOpenIssue) {
      return res.status(409).json({ message: "There is already an open issue for this contribution." });
    }

    const newIssue = await PaymentIssue.create({
      contributionId,
      raisedBy: req.user._id,
      description: description.trim(),
      status: "REPORTED",
    });

    contribution.status = "ISSUE";
    contribution.issueReason = description.trim();
    await contribution.save();

    // Member reports -> tell the organizer. Organizer reports -> tell the member.
    const group = await Group.findById(contribution.groupId);
    const notifyUserId = isOwner ? group?.organizerId : contribution.memberId;

    if (notifyUserId && !notifyUserId.equals(req.user._id)) {
      await createNotification(
        notifyUserId,
        "PAYMENT_FLAGGED",
        "Issue reported on payment",
        `A payment issue has been reported${group ? ` in "${group.groupName}"` : ""}: ${description.trim()}`,
        { relatedModel: "Contribution", relatedId: contribution._id }
      );
    }

    return res.status(201).json(newIssue);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /groups/:groupId/issues — organizer view of every issue in a group.
// Requires protect and isGroupOrganizer to have run first.
export const listIssuesForGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    const contributions = await Contribution.find({ groupId }).select("_id");
    const contributionIds = contributions.map((c) => c._id);

    const issues = await PaymentIssue.find({ contributionId: { $in: contributionIds } })
      .populate("raisedBy", "fullName email")
      .sort({ createdAt: -1 });

    return res.status(200).json(issues);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// PATCH /issues/:id/resolve — organizer moves an issue to UNDER_REVIEW or CORRECTION_REQUIRED.
// RESOLVED is NOT set here: an issue is only resolved automatically when the member's
// resubmitted evidence is approved (see reviewPaymentEvidence).
// Requires protect to have run first.
export const resolveIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body;

    if (status === "RESOLVED") {
      return res.status(400).json({
        message: "An issue is resolved automatically when the member's resubmitted evidence is approved. Use UNDER_REVIEW or CORRECTION_REQUIRED.",
      });
    }
    if (!["CORRECTION_REQUIRED", "UNDER_REVIEW"].includes(status)) {
      return res.status(400).json({ message: "status must be UNDER_REVIEW or CORRECTION_REQUIRED." });
    }
    if (status === "CORRECTION_REQUIRED" && (!resolutionNote || resolutionNote.trim() === "")) {
      return res.status(400).json({ message: "resolutionNote is required when requesting a correction." });
    }

    const issue = await PaymentIssue.findById(id);
    if (!issue) {
      return res.status(404).json({ message: "Payment issue record not found." });
    }
    if (issue.status === "RESOLVED") {
      return res.status(409).json({ message: "This issue is already resolved." });
    }

    const contribution = await Contribution.findById(issue.contributionId);
    if (!contribution) {
      return res.status(404).json({ message: "Associated contribution not found." });
    }

    const membership = await GroupMember.findOne({
      userId: req.user._id,
      groupId: contribution.groupId,
      status: "active",
      role: "organizer",
    });
    if (!membership) {
      return res.status(403).json({ message: "Only group organizers can update payment issues." });
    }

    issue.status = status;
    if (resolutionNote) issue.resolutionNote = resolutionNote.trim();
    await issue.save();

    if (status === "CORRECTION_REQUIRED") {
      contribution.issueReason = resolutionNote.trim();
      await contribution.save();
    }
    // The contribution stays ISSUE in both cases until the member resubmits.

    await createNotification(
      contribution.memberId,
      "PAYMENT_FLAGGED",
      status === "CORRECTION_REQUIRED" ? "Correction required on payment" : "Payment issue under review",
      status === "CORRECTION_REQUIRED"
        ? `Please resubmit your payment evidence: ${resolutionNote.trim()}`
        : "The organizer is reviewing the issue on your payment.",
      { relatedModel: "Contribution", relatedId: contribution._id }
    );

    return res.status(200).json(issue);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
