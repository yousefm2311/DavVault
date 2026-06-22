import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { handleChat, explainCodeFile, getSessions, getSessionById } from '../controllers/ai.controller';
import { validateBody } from '../middleware/validation';
import { apiLimiter } from '../middleware/security';

const router = Router();

router.post('/chat', authenticate, apiLimiter, validateBody(['message']), handleChat);
router.post('/explain-code', authenticate, apiLimiter, validateBody(['code', 'fileName']), explainCodeFile);
router.get('/sessions', authenticate, getSessions);
router.get('/sessions/:id', authenticate, getSessionById);

export default router;
