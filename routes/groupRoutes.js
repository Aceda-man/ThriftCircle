import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isGroupMember, isGroupOrganizer } from "../middleware/groupAuthMiddleware.js";
import {
    createGroup,
    joinGroup,
    getGroupDetails,
    getMyGroups,
    approveMember,
    rejectMember,
    getPendingMembers
} from "../controllers/groupController.js";

const router = express.Router();

router.post("/", protect, createGroup);
router.post("/join", protect, joinGroup);
router.get("/mine", protect, getMyGroups);
router.get("/:groupId", protect, isGroupMember, getGroupDetails);
router.get("/:groupId/pending", protect, isGroupOrganizer, getPendingMembers);
router.patch("/:groupId/members/:userId/approve", protect, isGroupOrganizer, approveMember);
router.patch("/:groupId/members/:userId/reject", protect, isGroupOrganizer, rejectMember);

export default router;