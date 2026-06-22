import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { searchHybrid, getQuickStats } from '../controllers/search.controller';
import { validateBody } from '../middleware/validation';
import { apiLimiter } from '../middleware/security';

const router = Router();

router.post('/', authenticate, apiLimiter, validateBody(['query']), searchHybrid);
router.get('/stats', authenticate, getQuickStats);

export default router;
