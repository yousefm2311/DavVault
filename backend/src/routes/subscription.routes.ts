import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getSubscription, upgradeSubscription } from '../controllers/subscription.controller';

const router = Router();

router.get('/', authenticate, getSubscription);
router.post('/upgrade', authenticate, upgradeSubscription);

export default router;
