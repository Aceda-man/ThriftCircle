import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import { generateAccessToken, generateRefreshToken } from "../utils/generateTokens.js";

const SALT_ROUNDS = 10;
const ROLES = ["ORGANIZER", "MEMBER"];

// to never leak passwordHash or reset codes
const toPublicUser = (user) => ({
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    createdAt: user.createdAt
});

// Rejects anything that isn't a string (objects like { "$ne": null }, arrays, numbers).
const isInvalidOptionalString = (value) =>
    value !== undefined && value !== null && typeof value !== "string";

const hasInvalidInput = (...values) => values.some(isInvalidOptionalString);

// Logs the real error on the server, sends a safe message to the client
const serverError = (res, err) => {
    console.error(err);
    return res.status(500).json({ message: "Something went wrong." });
};

// looks up a user by whichever identifier was provided, priority is on email tho
const findUserByEmailOrPhone = async ({ email, phoneNumber }) => {
    if (email) return User.findOne({ email: email.toLowerCase() });
    if (phoneNumber) return User.findOne({ phoneNumber });
    return null;
};

// POST /auth/signup
export const signup = async (req, res) => {
    try {
        const { fullName, email, phoneNumber, password, confirmPassword, role } = req.body;

        if (hasInvalidInput(fullName, email, phoneNumber, password, confirmPassword, role)) {
            return res.status(400).json({ message: "Invalid input format." });
        }

        // confirmPassword is checked on the frontend and is not required here
        if (!fullName || !email || !phoneNumber || !password) {
            return res.status(400).json({ message: "All fields are required." });
        }

        // role is optional, but if it is sent it must be valid
        if (role !== undefined && role !== null && !ROLES.includes(role)) {
            return res.status(400).json({
                message: "Role must be ORGANIZER or MEMBER.",
                errors: [{ field: "role", message: "Role must be ORGANIZER or MEMBER" }]
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters.",
                errors: [{ field: "password", message: "Minimum 8 characters" }]
            });
        }

        // only compare if the client actually sent it
        if (confirmPassword !== undefined && confirmPassword !== null && password !== confirmPassword) {
            return res.status(400).json({
                message: "Passwords do not match.",
                errors: [{ field: "confirmPassword", message: "Passwords do not match" }]
            });
        }

        const normalizedEmail = email.toLowerCase();

        const existingEmail = await User.findOne({ email: normalizedEmail });
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

        const user = await User.create({
            fullName,
            email: normalizedEmail,
            phoneNumber,
            passwordHash,
            ...(role ? { role } : {})
        });

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        // Store only a hash of the refresh token
        user.refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
        await user.save();

        res.status(201).json({ user: toPublicUser(user), accessToken, refreshToken });
    } catch (err) {
        // two signups at the same moment can both pass the checks above; the unique index catches the second
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern || {})[0] || "email or phone number";
            return res.status(409).json({
                message: `${field} already in use.`,
                errors: [{ field, message: "Already in use" }]
            });
        }
        return serverError(res, err);
    }
};

// POST /auth/login
export const login = async (req, res) => {
    try {
        const { email, phoneNumber, password } = req.body;

        if (hasInvalidInput(email, phoneNumber, password)) {
            return res.status(400).json({ message: "Invalid input format." });
        }

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
        return serverError(res, err);
    }
};

// POST /auth/forgot-password
export const forgotPassword = async (req, res) => {
    try {
        const { email, phoneNumber } = req.body;

        if (hasInvalidInput(email, phoneNumber)) {
            return res.status(400).json({ message: "Invalid input format." });
        }

        const user = await findUserByEmailOrPhone({ email, phoneNumber });

        // this doesn't reveal whether the account exists
        const genericResponse = { message: "If that account exists, a reset code has been sent." };

        if (!user) {
            return res.status(200).json(genericResponse);
        }

        const resetCode = crypto.randomInt(100000, 999999).toString(); // 6-digit code
        user.resetPasswordCodeHash = crypto.createHash("sha256").update(resetCode).digest("hex");
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min
        await user.save();

        // TODO: send resetCode via email/SMS provider. Do not log or return it in the response.
        // await sendResetCode(user, resetCode);

        res.status(200).json(genericResponse);
    } catch (err) {
        return serverError(res, err);
    }
};

// POST /auth/reset-password
export const resetPassword = async (req, res) => {
    try {
        const { email, phoneNumber, resetCode, newPassword } = req.body;

        if (hasInvalidInput(email, phoneNumber, resetCode, newPassword)) {
            return res.status(400).json({ message: "Invalid input format." });
        }

        if ((!email && !phoneNumber) || !resetCode || !newPassword) {
            return res.status(400).json({ message: "Email or phone number, resetCode, and newPassword are required." });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters." });
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
        return serverError(res, err);
    }
};

// POST /auth/refresh
export const refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (hasInvalidInput(refreshToken)) {
            return res.status(400).json({ message: "Invalid input format." });
        }

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
            // Token doesn't match what we last issued: possible reuse/theft, force logout
            return res.status(401).json({ message: "Invalid or expired refresh token." });
        }

        const newAccessToken = generateAccessToken(user._id);
        const newRefreshToken = generateRefreshToken(user._id);

        user.refreshTokenHash = crypto.createHash("sha256").update(newRefreshToken).digest("hex");
        await user.save();

        res.status(200).json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
    } catch (err) {
        return serverError(res, err);
    }
};

// POST /auth/logout
export const logout = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken || typeof refreshToken !== "string") {
            return res.status(204).send();
        }

        try {
            const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
            await User.findByIdAndUpdate(decoded.userId, { refreshTokenHash: null });
        } catch (err) {
            // Token already invalid/expired: logout is still a success from the client's perspective
        }

        res.status(204).send();
    } catch (err) {
        return serverError(res, err);
    }
};