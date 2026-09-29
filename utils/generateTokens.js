import jwt from "jsonwebtoken";

// Short-lived — sent on every authenticated request
export const generateAccessToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET, {
        expiresIn: "20m"
    });
};

// Long-lived — only used to hit /auth/refresh
export const generateRefreshToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: "30d"
    });
};