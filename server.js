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

// 1. Proxy tracking fix for express-rate-limit
app.set("trust proxy", 1);

app.use(helmet());

// 2. Open CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// 3. JSON Parsing Error Catcher
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

// 4. Security middleware to sanitize request fields
app.use((req, res, next) => {
  if (req.body) req.body = mongoSanitize.sanitize(req.body);
  if (req.params) req.params = mongoSanitize.sanitize(req.params);
  next();
});

// 5. Root health check endpoint for Render's monitors
app.get("/", (req, res) => {
  res.status(200).json({ status: "success", message: "ThriftCircle API is live and healthy." });
});

// 6. Primary API Router Grouping
app.use("/api", router);

dns.setServers(["8.8.8.8", "1.1.1.1"]);

// 7. Global error handler middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      message: err.code === "LIMIT_FILE_SIZE" ? "File must be 5MB or less." : err.message,
    });
  }
  console.error(err.stack);
  res.status(err.statusCode || 500).json({ message: err.message || "Something went wrong." });
});

// 8. CRUCIAL FIX: Start the port listener immediately so Render sees your app as healthy
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server is listening on interface 0.0.0.0 and port ${PORT}`);
  
  // 9. Process database connectivity and schedules asynchronously without blocking bootup
  try {
    await connectDB();
    console.log("Mongodb connected successfully");
    
    startContributionScheduler();
    startScheduler();
    console.log("Schedulers initialized successfully");
  } catch (error) {
    console.error("Asynchronous initialization failure:", error);
  }
});
