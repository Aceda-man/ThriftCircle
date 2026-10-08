import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { listNotifications, markAsRead, markAllAsRead } from "../controllers/notificationController.js";

const router = express.Router();

// Mounted at /notifications in routes/index.js
router.get("/", protect, listNotifications);
router.patch("/read-all", protect, markAllAsRead);
router.patch("/:notificationId/read", protect, markAsRead);

export default router;