import mongoose from "mongoose";

const contributionModelSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true
    },
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: [0.01, "Amount must be greater than 0"]
        },
    dueDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['DUE', 'PENDING_REVIEW', 'CONFIRMED', 'ISSUE', 'OVERDUE'],
        default: 'DUE'
    },
    submittedAt: {
        type: Date,
        default: null
    },
    confirmedAt: {
        type: Date,
        default: null
    },
    issueReason: {
        type: String,
        trim: true,
        default: null,
        //for cassees when there is an issue, tell frontend
        validate: {
        validator: function (value) {
                    return this.status !== "ISSUE" || (value && value.length > 0);
                },
                message: "issueReason is required when status is 'ISSUE'"
            }
    }
},
    {
        timestamps: true
    }
);
contributionModelSchema.index(
    { groupId: 1, memberId: 1, dueDate: 1 },
    { unique: true }
);

const Contribution = mongoose.model("Contribution", contributionModelSchema);


export default Contribution; 
