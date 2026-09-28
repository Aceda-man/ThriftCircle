import crypto from "crypto";

// Produces a short, typeable invite code, for example "7F3KQ9"
export const generateInviteCode = () => {
    return crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
};