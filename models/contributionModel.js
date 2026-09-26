import mongoose from 'mongoose';

const contributionModelSchema = new mongoose.Schema({
    group_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true
    },
    member_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    due_date: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['DUE', 'PENDING_REVIEW', 'CONFIRMED', 'ISSUE', 'OVERDUE'],
        default: 'DUE'
    },
    submitted_at: {
        type: Date,
        default: null
    },
    confirmed_at: {
        type: String,
        default: null
    },
    issue_reason: {
        type: String,
        default: null
    }
},
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    }
);

contributionModelSchema.index({
    group_id: 1,
    member_id: 1
}); // This creates a database index that tells our MongoDb to sort entries in ascending order 

const Contribution = mongoose.model('Contribution', contributionModelSchema); //complies the (contributionModelSchema) to an official mongoose model(Contribution)


export default Contribution; // to use this model - import Contribution from '../models/contributionModel.js'