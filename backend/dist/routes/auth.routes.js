"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const validation_1 = require("../middleware/validation");
const security_1 = require("../middleware/security");
const router = (0, express_1.Router)();
// Apply auth rate limiters to protect endpoints
router.post('/register', security_1.authLimiter, (0, validation_1.validateBody)(['name', 'email', 'password']), validation_1.validateEmail, auth_controller_1.register);
router.post('/login', security_1.authLimiter, (0, validation_1.validateBody)(['email', 'password']), validation_1.validateEmail, auth_controller_1.login);
router.post('/verify', security_1.authLimiter, (0, validation_1.validateBody)(['email', 'code']), validation_1.validateEmail, auth_controller_1.verifyCode);
router.post('/resend-verification', security_1.authLimiter, (0, validation_1.validateBody)(['email']), validation_1.validateEmail, auth_controller_1.resendCode);
router.post('/refresh', auth_controller_1.refresh);
router.post('/logout', auth_controller_1.logout);
// Google/GitHub OAuth stubs
router.post('/oauth/stub', security_1.authLimiter, (0, validation_1.validateBody)(['name', 'email', 'provider']), auth_controller_1.socialLoginStub);
exports.default = router;
