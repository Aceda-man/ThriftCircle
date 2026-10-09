import streamifier from "streamifier";
import cloudinary from "../config/cloudinaryConfig.js";
import Contribution from "../models/contributionModel.js";
import PaymentEvidence from "../models/paymentEvidenceModel.js";
import PaymentIssue from "../models/paymentIssueModel.js";
import Group from "../models/groupModel.js";
import GroupMember from "../models/groupMemberModel.js";
import { createNotification } from "./notificationController.js";
import { checkAndCloseCycle } from "./cycleController.js";
import { getRulesForGroup } from "../utils/getGroupRules.js";

const OPEN_ISSUE_STATUSES = ["REPORTED", "UNDER_REVIEW", "CORRECTION_REQUIRED"];

// POST /contributions/:contributionId/evidence
export const submitPaymentEvidence = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "A file is required." });
    }

    const contribution = await Contribution.findById(req.params.contributionId);
    if (!contribution) {
      return res.status(404).json({ message: "Contribution not found." });
    }

    if (!contribution.memberId.equals(req.user._id)) {
      return res
        .status(403)
        .json({
          message: "You can only submit evidence for your own contribution.",
        });
    }

    if (["CONFIRMED", "PENDING_REVIEW"].includes(contribution.status)) {
      return res
        .status(409)
        .json({
          message: `Evidence has already been submitted (status: ${contribution.status}).`,
        });
    }

    if (contribution.status === "OVERDUE") {
      const rules = await getRulesForGroup(contribution.groupId);
      if (!rules.allowLateSubmission) {
        return res
          .status(409)
          .json({
            message:
              "This group does not accept late submissions. Please contact the organizer.",
          });
      }
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "payment_evidence", resource_type: "auto" },
        (error, result) => (error ? reject(error) : resolve(result)),
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    const evidence = await PaymentEvidence.create({
      contributionId: contribution._id,
      submittedBy: req.user._id,
      fileUrl: uploadResult.secure_url,
      filePublicId: uploadResult.public_id,
      fileType: req.file.mimetype === "application/pdf" ? "pdf" : "image",
      note: req.body.note || null,
    });

    // Any older evidence still waiting for review is replaced by this resubmission.
    await PaymentEvidence.updateMany(
      {
        contributionId: contribution._id,
        reviewStatus: "PENDING",
        _id: { $ne: evidence._id },
      },
      {
        $set: {
          reviewStatus: "REJECTED",
          reviewNote: "Superseded by a resubmission.",
        },
      },
    );

    // A resubmission puts any open issue back in front of the organizer.
    await PaymentIssue.updateMany(
      {
        contributionId: contribution._id,
        status: { $in: OPEN_ISSUE_STATUSES },
      },
      { $set: { status: "UNDER_REVIEW" } },
    );

    contribution.status = "PENDING_REVIEW";
    contribution.submittedAt = new Date();
    await contribution.save();

    const group = await Group.findById(contribution.groupId);
    if (group) {
      try {
        await createNotification(
          group.organizerId,
          "EVIDENCE_SUBMITTED",
          "Payment evidence submitted",
          `A member submitted payment evidence for "${group.groupName}" — awaiting your review.`,
          { relatedModel: "PaymentEvidence", relatedId: evidence._id },
        );
      } catch (err) {
        console.error(
          `[evidence] Organizer notification failed (evidence ${evidence._id}):`,
          err,
        );
      }
    }

    res.status(201).json(evidence);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /evidence/:evidenceId/review — any organizer of the group approves or rejects
export const reviewPaymentEvidence = async (req, res) => {
  try {
    const { decision, reviewNote } = req.body; // decision: "APPROVED" | "REJECTED"

    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return res
        .status(400)
        .json({ message: "decision must be APPROVED or REJECTED." });
    }
    if (decision === "REJECTED" && !reviewNote) {
      return res
        .status(400)
        .json({ message: "reviewNote is required when rejecting." });
    }

    const evidence = await PaymentEvidence.findById(req.params.evidenceId);
    if (!evidence) {
      return res.status(404).json({ message: "Evidence not found." });
    }

    const contribution = await Contribution.findById(evidence.contributionId);
    if (!contribution) {
      return res.status(404).json({ message: "Contribution not found." });
    }

    const membership = await GroupMember.findOne({
      userId: req.user._id,
      groupId: contribution.groupId,
      status: "active",
      role: "organizer",
    });
    if (!membership) {
      return res
        .status(403)
        .json({ message: "Only group organizers can review evidence." });
    }

    if (
      evidence.reviewStatus !== "PENDING" ||
      contribution.status !== "PENDING_REVIEW"
    ) {
      return res
        .status(409)
        .json({ message: "This evidence is not awaiting review." });
    }

    evidence.reviewStatus = decision;
    evidence.reviewedBy = req.user._id;
    evidence.reviewedAt = new Date();
    if (reviewNote) evidence.reviewNote = reviewNote;
    await evidence.save();

    contribution.status = decision === "APPROVED" ? "CONFIRMED" : "ISSUE";
    if (decision === "APPROVED") contribution.confirmedAt = new Date();
    if (decision === "REJECTED") contribution.issueReason = reviewNote;
    await contribution.save();

    if (decision === "REJECTED") {
      // Reuse the open issue if there is one; otherwise open a new, trackable one.
      const openIssue = await PaymentIssue.findOne({
        contributionId: contribution._id,
        status: { $in: OPEN_ISSUE_STATUSES },
      });

      if (openIssue) {
        openIssue.status = "CORRECTION_REQUIRED";
        openIssue.resolutionNote = reviewNote;
        await openIssue.save();
      } else {
        await PaymentIssue.create({
          contributionId: contribution._id,
          raisedBy: req.user._id,
          description: reviewNote,
          status: "CORRECTION_REQUIRED",
        });
      }
    }

    if (decision === "APPROVED") {
      // An approved resubmission is what resolves an issue.
      await PaymentIssue.updateMany(
        {
          contributionId: contribution._id,
          status: { $in: OPEN_ISSUE_STATUSES },
        },
        {
          $set: {
            status: "RESOLVED",
            resolutionNote: "Resolved by approved resubmission.",
          },
        },
      );
    }

    await createNotification(
      contribution.memberId,
      decision === "APPROVED" ? "PAYMENT_CONFIRMED" : "PAYMENT_FLAGGED",
      decision === "APPROVED" ? "Payment confirmed" : "Payment needs attention",
      decision === "APPROVED"
        ? "Your payment was confirmed."
        : `Your payment was flagged: ${reviewNote}`,
      { relatedModel: "Contribution", relatedId: contribution._id },
    );

    if (decision === "APPROVED") {
      await checkAndCloseCycle(contribution.groupId, contribution.cycleNumber);
    }

    res.status(200).json({ evidence, contribution });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
