import Cycle from '../models/cycleModel.js';

export const getCurrentCycle = async (req, res) => {
    try {
        const { groupId } = req.params;

        const currentActiveCycle = await Cycle.findOne({
            groupId: groupId,
            status: 'ACTIVE'
        })
        .populate('recipientId', 'full_name email phone_number');

        if (!currentActiveCycle) {
            return res.status(404).json({
                success: false,
                message: 'There are no active contribution cycles currently running for this group.'
            });
        }

        return res.status(200).json({
            success: true,
            data: currentActiveCycle
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
