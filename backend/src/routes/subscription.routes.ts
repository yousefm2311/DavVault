import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { createCheckoutSession, getSubscription, upgradeSubscription } from '../controllers/subscription.controller';

const router = Router();

router.get('/', authenticate, getSubscription);
router.post('/upgrade', authenticate, upgradeSubscription);
router.post('/checkout', authenticate, createCheckoutSession);

export default router;
