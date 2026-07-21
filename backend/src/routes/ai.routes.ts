import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanLimits } from '../middleware/limits';
import {
  handleChat,
  explainCodeFile,
  getSessions,
  getSessionById,
  deleteSession,
  simulateTeamDiscussion,
  getAgents,
  createAgent,
  deleteAgent,
  debugContextTrace
} from '../controllers/ai.controller';
import { validateBody } from '../middleware/validation';
import { apiLimiter } from '../middleware/security';

const router = Router();

router.post('/chat', authenticate, checkPlanLimits('aiQuestions'), apiLimiter, validateBody(['message']), handleChat);
router.post('/explain-code', authenticate, checkPlanLimits('aiQuestions'), apiLimiter, validateBody(['code', 'fileName']), explainCodeFile);
router.post('/debug/context-trace', authenticate, apiLimiter, validateBody(['message', 'mode']), debugContextTrace);
router.get('/sessions', authenticate, getSessions);
router.get('/sessions/:id', authenticate, getSessionById);
router.delete('/sessions/:id', authenticate, deleteSession);
router.post('/team-simulation', authenticate, apiLimiter, validateBody(['projectId', 'task']), simulateTeamDiscussion);

// AI Agent Management Routes
router.get('/agents', authenticate, getAgents);
router.post('/agents', authenticate, apiLimiter, validateBody(['name', 'role', 'focus', 'systemPrompt']), createAgent);
router.delete('/agents/:id', authenticate, deleteAgent);

export default router;
