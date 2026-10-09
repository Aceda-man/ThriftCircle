import GroupRule from "../models/groupRuleModel.js";

export const DEFAULT_RULES = {
    gracePeriodDays: 0,
    allowLateSubmission: true,
    maxMembers: null
};

// Returns the group's rules, or the defaults if the organizer never set any.
export const getRulesForGroup = async (groupId) => {
    const rules = await GroupRule.findOne({ groupId });
    if (!rules) return { ...DEFAULT_RULES };

    return {
        gracePeriodDays: rules.gracePeriodDays,
        allowLateSubmission: rules.allowLateSubmission,
        maxMembers: rules.maxMembers
    };
};