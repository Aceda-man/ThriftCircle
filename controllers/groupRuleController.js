import GroupRule from "../models/groupRuleModel.js";
import GroupMember from "../models/groupMemberModel.js";
import { getRulesForGroup } from "../utils/getGroupRules.js";

// GET /groups/:groupId/rules — requires isGroupMember to have run first
export const getGroupRules = async (req, res) => {
    try {
        const { groupId } = req.params;
        const rules = await getRulesForGroup(groupId);
        res.status(200).json({ groupId, ...rules });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /groups/:groupId/rules — requires isGroupOrganizer to have run first.
// Send only the rules you want to change.
export const setGroupRules = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { gracePeriodDays, allowLateSubmission, maxMembers } = req.body;
        const update = {};

        if (gracePeriodDays !== undefined) {
            if (!Number.isInteger(gracePeriodDays) || gracePeriodDays < 0 || gracePeriodDays > 30) {
                return res.status(400).json({ message: "gracePeriodDays must be a whole number from 0 to 30." });
            }
            update.gracePeriodDays = gracePeriodDays;
        }

        if (allowLateSubmission !== undefined) {
            if (typeof allowLateSubmission !== "boolean") {
                return res.status(400).json({ message: "allowLateSubmission must be true or false." });
            }
            update.allowLateSubmission = allowLateSubmission;
        }

        if (maxMembers !== undefined) {
            if (maxMembers !== null) {
                if (!Number.isInteger(maxMembers) || maxMembers < 2) {
                    return res.status(400).json({ message: "maxMembers must be a whole number of at least 2, or null for no limit." });
                }
                const activeCount = await GroupMember.countDocuments({ groupId, status: "active" });
                if (maxMembers < activeCount) {
                    return res.status(409).json({
                        message: `The group already has ${activeCount} active members, so maxMembers cannot be lower than that.`
                    });
                }
            }
            update.maxMembers = maxMembers;
        }

        if (Object.keys(update).length === 0) {
            return res.status(400).json({ message: "Provide at least one rule to change." });
        }

        update.updatedBy = req.user._id;

        await GroupRule.findOneAndUpdate(
            { groupId },
            { $set: update },
            { upsert: true, setDefaultsOnInsert: true }
        );

        const rules = await getRulesForGroup(groupId);
        res.status(200).json({ groupId, ...rules });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};