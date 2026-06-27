import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';
import { validatePassword } from '../middleware/validation';

const router = Router();

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, validatePassword, updateProfile);

export default router;
