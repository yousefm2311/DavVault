"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const timemachine_controller_1 = require("../controllers/timemachine.controller");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticate, timemachine_controller_1.getTimeMachineTimeline);
exports.default = router;
