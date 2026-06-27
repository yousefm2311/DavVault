import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createBillingPortalSession,
  createCheckoutSession,
  getSubscription,
} from '../controllers/subscription.controller';

const router = Router();

router.get('/', authenticate, getSubscription);
router.post('/checkout', authenticate, createCheckoutSession);
router.post('/portal', authenticate, createBillingPortalSession);

export default router;
