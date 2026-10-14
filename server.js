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
import { startScheduler } from "./jobs/scheduler.js";

const app = express();

app.use(helmet());

// Replace the CORS configuration in your server.js with this:

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
  : ["http://localhost:3000"]; // Fallback if the env variable is missing locally

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like Postman or server-to-server requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);


app.use(express.json());

app.use((req, res, next) => {
  if (req.body) req.body = mongoSanitize.sanitize(req.body);
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
      message: err.code === "LIMIT_FILE_SIZE" ? "File must be 5MB or less." : err.message,
    });
  }
  console.error(err.stack);
  res.status(err.statusCode || 500).json({ message: err.message || "Something went wrong." });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});
