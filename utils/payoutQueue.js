import GroupMember from "../models/GroupMember.js";
import Payout from "../models/Payout.js";

const getNextPayoutMember = async (groupId) => {

  // Get all active members in payout order
  const members = await GroupMember.find({
    groupId,
    status: "active"
  }).sort({ payoutOrder: 1 });

  if (members.length === 0) {
    throw new Error("No active members in this group");
  }

  // Get the last successful payout
  const lastPayout = await Payout.findOne({ 
    groupId,
    status: "paid"
  }).sort({
    createdAt: -1
  });


  // FIRST EVER PAYOUT
  if (!lastPayout) {
    const firstEligibleMember = members.find(
      (member) =>
        member.contributionStatus === "paid"
    );

    if (!firstEligibleMember) {
      throw new Error(
        "No member is currently eligible for payout"
      );
    }

    return {
      member: firstEligibleMember,
      cycle: 1
    };
  }


  // FIND LAST MEMBER
  const lastIndex = members.findIndex(
    (member) =>
      member.payoutOrder === lastPayout.payoutOrder
  );


  // CHECK MEMBERS AFTER LAST MEMBER
  for (let i = 1; i <= members.length; i++) {
    const nextIndex =
      (lastIndex + i) % members.length;

    const member = members[nextIndex];

    // Only paid contributions are eligible
    if (
      member.contributionStatus === "paid"
    ) {
      let cycle = lastPayout.cycle;

  
       //If we have wrapped from the last member back to the beginning, start a new cycle.
      if (nextIndex <= lastIndex) {
        cycle += 1;
      }

      return {
        member,
        cycle
      };
    }
  }

  throw new Error(
    "No eligible member is currently available"
  );
};

export default getNextPayoutMember