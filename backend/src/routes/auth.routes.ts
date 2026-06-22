import { Router } from 'express';
import {
  register,
  login,
  refresh,
  socialLoginStub,
  logout,
  verifyCode,
  resendCode,
  startOAuth,
  oauthCallback,
} from '../controllers/auth.controller';
import { validateBody, validateEmail } from '../middleware/validation';
import { authLimiter } from '../middleware/security';

const router = Router();

// Apply auth rate limiters to protect endpoints
router.post(
  '/register',
  authLimiter,
  validateBody(['name', 'email', 'password']),
  validateEmail,
  register
);

router.post(
  '/login',
  authLimiter,
  validateBody(['email', 'password']),
  validateEmail,
  login
);

router.post(
  '/verify',
  authLimiter,
  validateBody(['email', 'code']),
  validateEmail,
  verifyCode
);

router.post(
  '/resend-verification',
  authLimiter,
  validateBody(['email']),
  validateEmail,
  resendCode
);

router.post('/refresh', refresh);
router.post('/logout', logout);

router.get('/oauth/:provider/start', authLimiter, startOAuth);
router.get('/oauth/:provider/callback', oauthCallback);

// Google/GitHub OAuth stubs
router.post(
  '/oauth/stub',
  authLimiter,
  validateBody(['name', 'email', 'provider']),
  socialLoginStub
);

export default router;
