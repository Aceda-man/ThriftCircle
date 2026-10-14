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

// Open CORS Configuration: Automatically allows ANY origin making the request
app.use(
  cors({
    origin: (origin, callback) => {
      // Echoes back the requesting origin to bypass all CORS locks globally
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// JSON Parsing Error Catcher: Stops malformed frontend requests from crashing the server
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error("Caught a malformed JSON payload from frontend.");
    return res.status(400).json({ 
      status: "error", 
      message: "The server received an invalid JSON format from the frontend." 
    });
  }
  next(err);
});

// Security middleware to sanitize request fields
app.use((req, res, next) => {
  if (req.body) req.body = mongoSanitize.sanitize(req.body);
  if (req.params) req.params = mongoSanitize.sanitize(req.params);
  next();
});

// Root entry point to prevent "Cannot GET /" message
app.get("/", (req, res) => {
  res.status(200).json({ status: "success", message: "ThriftCircle API is live and healthy." });
});

// Primary API Router Grouping
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
