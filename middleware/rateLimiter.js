import rateLimit from "express-rate-limit";

// Applies to login, signup, forgot-password, reset-password
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 20,                // per IP per window (mobile carriers share IPs, so not too tight)
    message: { message: "Too many attempts. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
});