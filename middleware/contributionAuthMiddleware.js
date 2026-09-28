import Contribution from "../models/contributionModel.js";
import GroupMember from "../models/groupMemberModel.js";

// Caller must EITHER own this contribution, OR be an organizer of the group it belongs to.
// groupId isn't in the URL for this route, so it's derived from the contribution itself.
export const canAccessContribution = async (req, res, next) => {
    try {
        const contribution = await Contribution.findById(req.params.contributionId);
        if (!contribution) {
            return res.status(404).json({ message: "Contribution not found." });
        }

        const isOwner = contribution.memberId.equals(req.user._id);

        if (!isOwner) {
            const membership = await GroupMember.findOne({
                userId: req.user._id,
                groupId: contribution.groupId,
                status: "active",
                role: "organizer"
            });

            if (!membership) {
                return res.status(403).json({ message: "You don't have access to this contribution." });
            }
        }

        req.contribution = contribution; // controller reuses this, no need to re-fetch
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};