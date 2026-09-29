// Dev helper: runs the reminder job immediately instead of waiting for the daily schedule.
// Usage (from serverside/):  node jobs/runOnce.js
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import { runContributionReminders } from "./contributionReminder.js";

await connectDB();
const result = await runContributionReminders();
console.log(result);
await mongoose.disconnect();
process.exit(0);