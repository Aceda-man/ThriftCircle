import Payout from "../models/Payout.js";
import getNextPayoutMember from "../utils/payoutQueue.js"


// POST /groups/:groupId/payout
// Organizer confirms that a payout happened
import Payout from "../models/Payout.js";
import { getNextPayoutMember } from "../utils/payoutQueue.js"; 

const confirmPayout = async (req, res, next) => {

  try {
    const { groupId } = req.params;

    const {
      payoutAmount,
      scheduledDate
    } = req.body;

    if (!payoutAmount || payoutAmount <= 0) {
      return res.status(400).json({
        message: "Payout amount must be greater than zero"
      });
    }

    // Find next eligible member
    const {
      member,
      cycle
    } = await getNextPayoutMember(groupId);


    //prevent duplicate payout
    const existingPayout = await Payout.findOne({
      groupId,
      memberId: member.memberId,
      cycle
    });

    if (existingPayout) {
      return res.status(400).json({
        message:
          "This member has already received payout in this cycle"
      });
    }


    // Create payout record
    const payout = await Payout.create({
      groupId,

      memberId: member.memberId,

      payoutOrder: member.payoutOrder,

      cycle,

      payoutAmount,

      scheduledDate:
        scheduledDate || new Date(),

      paidAt: new Date(),

      status: "paid"
    });

    res.status(201).json({
      message: "Payout confirmed successfully",

      payout
    });

  } catch (error) {
    next(error);
  }
};


// GET /groups/:groupId/payouts. Get payout history
const getPayoutHistory = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const payouts = await Payout.find({
      groupId
    })
      .populate("memberId", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      count: payouts.length,
      payouts
    });

  } catch (error) {
    next(error);
  }
};

export { confirmPayout, getPayoutHistory }