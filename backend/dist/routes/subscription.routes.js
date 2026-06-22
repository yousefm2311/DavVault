"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const subscription_controller_1 = require("../controllers/subscription.controller");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticate, subscription_controller_1.getSubscription);
router.post('/upgrade', auth_1.authenticate, subscription_controller_1.upgradeSubscription);
exports.default = router;
