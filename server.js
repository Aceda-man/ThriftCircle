import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer"; 
import mongoSanitize from "express-mongo-sanitize";
import dns from "node:dns";
import "dotenv/config";
import connectDB from "./config/db.js";
import router from "./routes/index.js";
import { startContributionScheduler } from "./cron/contributionScheduler.js";
import { startScheduler } from "./jobs/scheduler.js"

const app = express();

app.use(helmet());

app.use(cors({
    origin: "*" //reminder to inrtegrate cors under.env before deployment
}));

app.use(express.json());

app.use((req, res, next) => {
    if (req.body)   req.body   = mongoSanitize.sanitize(req.body);
    if (req.params) req.params = mongoSanitize.sanitize(req.params);
    next();
});
app.use("/api", router);

dns.setServers(["8.8.8.8", "1.1.1.1"]);

connectDB().then(() => {
    startContributionScheduler();
    startScheduler();
});

// Global error handler 
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) { 
        return res.status(400).json({        
            message: err.code === "LIMIT_FILE_SIZE" ? "File must be 5MB or less." : err.message 
        });                                  
    }                                        
    console.error(err.stack);
    res.status(err.statusCode || 500).json({ message: err.message || "Something went wrong." });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
});