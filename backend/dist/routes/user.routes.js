"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/profile', auth_1.authenticate, user_controller_1.getProfile);
router.put('/profile', auth_1.authenticate, user_controller_1.updateProfile);
exports.default = router;
