import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/usersModel.js";
import { generateAccessToken, generateRefreshToken } from "../utils/generateTokens.js";

const SALT_ROUNDS = 10;

// to never leak passwordHash or reset codes//
const toPublicUser = (user) => ({
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    createdAt: user.createdAt
});

// Looks up a user by whichever identifier was provided — email takes priority if somehow both are sent.
const findUserByEmailOrPhone = async ({ email, phoneNumber }) => {
    if (email) return User.findOne({ email: email.toLowerCase() });
    if (phoneNumber) return User.findOne({ phoneNumber });
    return null;
};

// POST /auth/signup
export const signup = async (req, res) => {
    try {
        const { fullName, email, phoneNumber, password, confirmPassword } = req.body;

        if (!fullName || !email || !phoneNumber || !password || !confirmPassword) {
            return res.status(400).json({ message: "All fields are required." });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                message: "Passwords do not match.",
                errors: [{ field: "confirmPassword", message: "Passwords do not match" }]
            });
        }

        const existingEmail = await User.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
            return res.status(409).json({
                message: "Email already in use.",
                errors: [{ field: "email", message: "Email already in use" }]
            });
        }

        const existingPhone = await User.findOne({ phoneNumber });
        if (existingPhone) {
            return res.status(409).json({
                message: "Phone number already in use.",
                errors: [{ field: "phoneNumber", message: "Phone number already in use" }]
            });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        const user = await User.create({ fullName, email, phoneNumber, passwordHash });

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        //Store only a hash of the refresh toke//
        user.refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
        await user.save();

        res.status(201).json({ user: toPublicUser(user), accessToken, refreshToken });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /auth/login
export const login = async (req, res) => {
    try {
        const { email, phoneNumber, password } = req.body;

        if ((!email && !phoneNumber) || !password) {
            return res.status(400).json({ message: "Email or phone number, and password, are required." });
        }

        const user = await findUserByEmailOrPhone({ email, phoneNumber });
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        user.refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
        await user.save();

        res.status(200).json({ user: toPublicUser(user), accessToken, refreshToken });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /auth/forgot-password
export const forgotPassword = async (req, res) => {
    try {
        const { email, phoneNumber } = req.body;
        const user = await findUserByEmailOrPhone({ email, phoneNumber });

        // this doesn't reveal whether the account exists to prevent risks
        const genericResponse = { message: "If that account exists, a reset code has been sent." };

        if (!user) {
            return res.status(200).json(genericResponse);
        }

        const resetCode = crypto.randomInt(100000, 999999).toString(); // 6-digit code
        user.resetPasswordCodeHash = crypto.createHash("sha256").update(resetCode).digest("hex");
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min
        await user.save();

        // TODO: send resetCode via email/SMS provider — do not log/return it in the response
        // await sendResetCode(user, resetCode);

        res.status(200).json(genericResponse);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /auth/reset-password
export const resetPassword = async (req, res) => {
    try {
        const { email, phoneNumber, resetCode, newPassword } = req.body;

        if ((!email && !phoneNumber) || !resetCode || !newPassword) {
            return res.status(400).json({ message: "Email or phone number, resetCode, and newPassword are required." });
        }

        const user = await findUserByEmailOrPhone({ email, phoneNumber });
        if (!user || !user.resetPasswordCodeHash || !user.resetPasswordExpires) {
            return res.status(400).json({ message: "Invalid or expired reset code." });
        }

        if (user.resetPasswordExpires < new Date()) {
            return res.status(400).json({ message: "Invalid or expired reset code." });
        }

        const codeHash = crypto.createHash("sha256").update(resetCode).digest("hex");
        if (codeHash !== user.resetPasswordCodeHash) {
            return res.status(400).json({ message: "Invalid or expired reset code." });
        }

        user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        user.resetPasswordCodeHash = null;
        user.resetPasswordExpires = null;
        user.refreshTokenHash = null; // force re-login everywhere after a password reset
        await user.save();

        res.status(200).json({ message: "Password updated successfully." });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /auth/refresh
export const refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ message: "refreshToken is required." });
        }

        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        } catch (err) {
            return res.status(401).json({ message: "Invalid or expired refresh token." });
        }

        const user = await User.findById(decoded.userId);
        if (!user || !user.refreshTokenHash) {
            return res.status(401).json({ message: "Invalid or expired refresh token." });
        }

        const incomingHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
        if (incomingHash !== user.refreshTokenHash) {
            // Token doesn't match what we last issued — possible reuse/theft, force logout
            return res.status(401).json({ message: "Invalid or expired refresh token." });
        }

        const newAccessToken = generateAccessToken(user._id);
        const newRefreshToken = generateRefreshToken(user._id);

        user.refreshTokenHash = crypto.createHash("sha256").update(newRefreshToken).digest("hex");
        await user.save();

        res.status(200).json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /auth/logout
export const logout = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(204).send();
        }

        try {
            const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
            await User.findByIdAndUpdate(decoded.userId, { refreshTokenHash: null });
        } catch (err) {
            // Token already invalid/expired — logout is still a success from the client's perspective
        }

        res.status(204).send();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};