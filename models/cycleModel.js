import mongoose from "mongoose";

const cycleSchema = new mongoose.Schema(
    {
        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Group',
            required: true
        },
        cycleNumber: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ["ACTIVE", "COMPLETED"],
            default: "ACTIVE"
        },
        recipientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: {
            createdAt: "created_at",
            updatedAt: "updated_at"
        }
    }
);

cycleSchema.index({ groupId: 1, status: 1 });

const Cycle = mongoose.model('Cycle', cycleSchema);


export default Cycle;