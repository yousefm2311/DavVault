import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getProjectReplay,
  generateStandup,
  getHiddenKnowledge,
  getOpportunity,
  getRecentActivities,
} from '../controllers/ai-extensions.controller';

const router = Router();

router.get('/projects/:id/replay', authenticate, getProjectReplay);
router.get('/standup', authenticate, generateStandup);
router.get('/hidden-knowledge', authenticate, getHiddenKnowledge);
router.get('/opportunity', authenticate, getOpportunity);
router.get('/activities', authenticate, getRecentActivities);

export default router;
