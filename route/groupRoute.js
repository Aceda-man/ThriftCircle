import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isGroupMember } from "../middleware/groupauthMiddleware.js";
import {
    createGroup,
    joinGroup,
    getGroupDetails,
    getMyGroups
} from "../controllers/groupController.js";

const router = express.Router();

router.post("/", protect, createGroup);
router.post("/join", protect, joinGroup);
router.get("/mine", protect, getMyGroups);
router.get("/:groupId", protect, isGroupMember, getGroupDetails);

export default router;