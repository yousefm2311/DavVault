import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  verifyCode,
  resendCode,
  startOAuth,
  oauthCallback,
  requestPasswordReset,
  resetPassword,
} from '../controllers/auth.controller';
import { validateBody, validateEmail, validatePassword } from '../middleware/validation';
import { authLimiter } from '../middleware/security';

const router = Router();

// Apply auth rate limiters to protect endpoints
router.post(
  '/register',
  authLimiter,
  validateBody(['name', 'email', 'password']),
  validateEmail,
  validatePassword,
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
router.post('/forgot-password', authLimiter, validateBody(['email']), validateEmail, requestPasswordReset);
router.post(
  '/reset-password',
  authLimiter,
  validateBody(['email', 'token', 'password']),
  validateEmail,
  validatePassword,
  resetPassword
);

router.get('/oauth/:provider/start', authLimiter, startOAuth);
router.get('/oauth/:provider/callback', oauthCallback);

export default router;
