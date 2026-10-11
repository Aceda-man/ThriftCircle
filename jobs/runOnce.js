// Dev helper: runs the reminder job immediately instead of waiting for the daily schedule.
// Usage (from serverside/):  node jobs/runOnce.js
import dns from "node:dns";
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import { runContributionReminders } from "./contributionReminder.js";

// Same DNS override as server.js. Without it the Atlas SRV lookup can fail on some networks.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

await connectDB();

if (mongoose.connection.readyState !== 1) {
    console.error("Could not connect to the database. Aborting.");
    process.exit(1);
}

const result = await runContributionReminders();
console.log(result);
await mongoose.disconnect();
process.exit(0);