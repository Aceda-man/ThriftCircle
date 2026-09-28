import express from "express";
import healthController from "../controllers/healthcontroller.js";
import authRoute from "./authRoute.js";
import groupRoute from "./groupRoute.js";
import contributionRoute from "./contributionRoute.js";
import contributionByIdRoute from "./contributionByIdRoute.js";

const router = express.Router();

router.get("/health", healthController.getHealth);

router.use("/auth", authRoute);
router.use("/groups", groupRoute);           // POST /groups, POST /groups/join, GET /groups/mine, GET /groups/:groupId
router.use("/groups", contributionRoute);    // GET /groups/:groupId/contributions (same "/groups" prefix, different route file)
router.use("/contributions", contributionByIdRoute); // GET /contributions/:contributionId

export default router;