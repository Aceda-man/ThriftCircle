import express from 'express';
import { getCurrentCycle } from '../controllers/cycleController.js';

const router = express.Router();

// Team Lead Requirement: GET /groups/:groupId/cycles/current
router.get('/groups/:groupId/cycles/current', getCurrentCycle);

export default router;
