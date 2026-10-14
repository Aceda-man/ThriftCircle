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

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();

// Render sits behind one proxy hop
app.set("trust proxy", 1);

app.use(helmet());

// CORS allowlist (comma-separated in the CORS_ORIGINS env var)
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow no-origin requests (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use((req, res, next) => {
  req.body ??= {};
  next();
});

// Friendly response for malformed JSON bodies
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      status: "error",
      message: "The server received an invalid JSON format.",
    });
  }
  next(err);
});

// Strip Mongo operators ($, .) from the request body
app.use((req, res, next) => {
  if (req.body) req.body = mongoSanitize.sanitize(req.body);
  next();
});

// Health check for Render
app.get("/", (req, res) => {
  res
    .status(200)
    .json({ status: "success", message: "ThriftCircle API is live and healthy." });
});

app.use("/api", router);

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

// Listen immediately so Render sees the service as healthy
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server is listening on interface 0.0.0.0 and port ${PORT}`);

  try {
    await connectDB();
    console.log("Mongodb connected successfully");

    startContributionScheduler();
    startScheduler();
    console.log("Schedulers initialized successfully");
  } catch (error) {
    console.error("Asynchronous initialization failure:", error);
    process.exit(1); // let Render restart instead of running without schedulers
  }
});