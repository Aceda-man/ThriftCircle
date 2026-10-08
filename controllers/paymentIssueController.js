import PaymentIssue from "../models/paymentIssueModel.js";
import Contribution from "../models/contributionModel.js";
import GroupMember from "../models/groupMemberModel.js";
import { createNotification } from "./notificationController.js";

// 1. Members or Organizers can report a payment issue
export const reportIssue = async (req, res) => {
  try {
    const { contributionId, description } = req.body;

    if (!contributionId || !description || description.trim() === "") {
      return res.status(400).json({ message: "Contribution ID and description are required." });
    }

    const contribution = await Contribution.findById(contributionId);
    if (!contribution) {
      return res.status(404).json({ message: "Contribution not found." });
    }

    // Auth check: User must own the contribution OR be an active group organizer
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

    const newIssue = await PaymentIssue.create({
      contributionId,
      raisedBy: req.user._id,
      description: description.trim(),
      status: "REPORTED",
    });

    contribution.status = "ISSUE";
    contribution.issueReason = description.trim();
    await contribution.save();

    // Reuses your team lead's native PAYMENT_FLAGGED notification configuration
    await createNotification(
      contribution.memberId,
      "PAYMENT_FLAGGED",
      "Issue reported on payment",
      `A payment issue has been reported: ${description.trim()}`,
      { relatedModel: "Contribution", relatedId: contribution._id }
    );

    return res.status(201).json(newIssue);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// 2. Organizer view to look up all issues belonging to a group
export const listIssuesForGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Organizer check via GroupMember lookup pattern
    const membership = await GroupMember.findOne({
      userId: req.user._id,
      groupId: groupId,
      status: "active",
      role: "organizer",
    });
    if (!membership) {
      return res.status(403).json({ message: "Only group organizers can view this issue log." });
    }

    const contributions = await Contribution.find({ groupId }).select("_id");
    const contributionIds = contributions.map((c) => c._id);

    const issues = await PaymentIssue.find({ contributionId: {$in: contributionIds } })
      .populate("raisedBy", "full_name email")
      .sort({ createdAt: -1 });

    return res.status(200).json(issues);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// 3. Organizer marks an issue as resolved or requests a correction
export const resolveIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body;

    if (!["RESOLVED", "CORRECTION_REQUIRED", "UNDER_REVIEW"].includes(status)) {
      return res.status(400).json({ message: "Invalid status target specified." });
    }

    const issue = await PaymentIssue.findById(id);
    if (!issue) {
      return res.status(404).json({ message: "Payment issue record not found." });
    }

    const contribution = await Contribution.findById(issue.contributionId);
    if (!contribution) {
      return res.status(404).json({ message: "Associated contribution not found." });
    }

    // Organizer check via GroupMember lookup pattern
    const membership = await GroupMember.findOne({
      userId: req.user._id,
      groupId: contribution.groupId,
      status: "active",
      role: "organizer",
    });
    if (!membership) {
      return res.status(403).json({ message: "Only group organizers can resolve payment issues." });
    }

    issue.status = status;
    if (resolutionNote) issue.resolutionNote = resolutionNote.trim();
    await issue.save();

    if (status === "RESOLVED") {
      contribution.status = "CONFIRMED";
      contribution.confirmedAt = new Date();
    } else if (status === "CORRECTION_REQUIRED") {
      contribution.status = "ISSUE";
      if (resolutionNote) contribution.issueReason = resolutionNote.trim();
    }
    await contribution.save();

    await createNotification(
      contribution.memberId,
      status === "RESOLVED" ? "PAYMENT_CONFIRMED" : "PAYMENT_FLAGGED",
      status === "RESOLVED" ? "Payment issue resolved" : "Correction required on payment",
      status === "RESOLVED"
        ? "Your payment issue was resolved and confirmed."
        : `Your payment requires correction: ${resolutionNote || ""}`,
      { relatedModel: "Contribution", relatedId: contribution._id }
    );

    return res.status(200).json(issue);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
