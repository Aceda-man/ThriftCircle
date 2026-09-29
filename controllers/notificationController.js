import mongoose from "mongoose";
import Notification from "../models/notificationModel.js";
//honestly, i barely understands how this work, got it from aguy on substack
//moment of truth when i test it, lol
const PUBLIC_FIELDS = "-dedupeKey -__v";

// GET /notifications?unread=true&page=1&limit=20
export const listNotifications = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);

    const filter = { recipientId: req.user._id };
    if (req.query.unread === "true") {
      filter.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select(PUBLIC_FIELDS),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipientId: req.user._id, isRead: false }),
    ]);

    res.status(200).json({ notifications, page, limit, total, unreadCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /notifications/:notificationId/read
export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    if (!mongoose.isValidObjectId(notificationId)) {
      return res.status(400).json({ message: "Invalid notification id." });
    }

    // recipientId in the filter means users can only ever touch their own notifications
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipientId: req.user._id },
      { $set: { isRead: true, readAt: new Date() } },
      { returnDocument: "after" }, // Updated line
    ).select(PUBLIC_FIELDS);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    res.status(200).json(notification);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /notifications/read-all
export const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipientId: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );

    res.status(200).json({ updated: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// Internal helper — not an HTTP route handler. Called by other controllers
// (e.g. paymentEvidenceController.js) to create a notification for a user.
export const createNotification = async (
  recipientId,
  type,
  title,
  message,
  options = {},
) => {
  try {
    await Notification.create({
      recipientId,
      type,
      title,
      message,
      relatedModel: options.relatedModel,
      relatedId: options.relatedId,
    });
  } catch (err) {
    // A failed notification shouldn't crash whatever triggered it (e.g. a payment review) —
    // log it and move on rather than throwing.
    console.error("Failed to create notification:", err.message);
  }
};
