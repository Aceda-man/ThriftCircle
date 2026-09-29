import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
    listNotifications,
    markAsRead,
    markAllAsRead
} from "../controllers/notificationController.js";

const router = express.Router();

router.use(protect); // every notification route needs a logged-in user

router.get("/", listNotifications);
router.patch("/read-all", markAllAsRead);
router.patch("/:notificationId/read", markAsRead);

export default router;