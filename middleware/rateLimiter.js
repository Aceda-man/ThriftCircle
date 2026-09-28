import rateLimit from "express-rate-limit";

// Applies to login, signup, forgot-password — the endpoints most exposed to
// brute-force/enumeration attempts.
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,                   // 10 requests per IP per window
    message: { message: "Too many attempts. Please try again in 15 minutes." },
    standardHeaders: true,     // adds RateLimit-* headers to the response
    legacyHeaders: false
});