import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getTimeMachineTimeline } from '../controllers/timemachine.controller';

const router = Router();

router.get('/', authenticate, getTimeMachineTimeline);

export default router;
