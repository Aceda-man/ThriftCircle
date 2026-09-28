import express from "express";
import cors from "cors";
import dns from "node:dns";
import "dotenv/config";
import connectDB from "./config/db.js";
import router from "./route/index.js";
import { startContributionScheduler } from "./cron/contributionScheduler.js";

const app = express();

app.use(cors({
    origin: "*"
}));

app.use(express.json());
app.use("/api", router);


dns.setServers(["8.8.8.8", "1.1.1.1"]);

connectDB().then(() => {
    startContributionScheduler();
});

// Global error handler 
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({ message: err.message || "Something went wrong." });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
});