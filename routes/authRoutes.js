import express from "express";
import { authLimiter } from "../middleware/rateLimiter.js"
import {
    signup,
    login,
    forgotPassword,
    resetPassword,
    refresh,
    logout
} from "../controllers/authController.js";

const router = express.Router();


router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);
router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;