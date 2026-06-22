"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePlan = exports.isSuperAdmin = exports.isAdmin = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const models_1 = require("../models");
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const secret = process.env.JWT_SECRET || 'devvault_secret_access_token_key_2026';
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        const user = await models_1.User.findById(decoded.id, 'email plan role status');
        if (!user) {
            return res.status(401).json({ error: 'Invalid token user.' });
        }
        if (user.status === 'suspended') {
            return res.status(403).json({ error: 'Account suspended. Contact support.' });
        }
        req.user = {
            id: user._id.toString(),
            email: user.email,
            plan: user.plan,
            role: user.role || 'user',
            status: user.status || 'active',
        };
        next();
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        return res.status(403).json({ error: 'Invalid token.' });
    }
};
exports.authenticate = authenticate;
const isAdmin = (req, res, next) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
        return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
    next();
};
exports.isAdmin = isAdmin;
const isSuperAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Access denied. Super administrator privileges required.' });
    }
    next();
};
exports.isSuperAdmin = isSuperAdmin;
const requirePlan = (allowedPlans) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized.' });
        }
        if (!allowedPlans.includes(req.user.plan)) {
            return res.status(403).json({ error: `Requires one of the plans: ${allowedPlans.join(', ')}` });
        }
        next();
    };
};
exports.requirePlan = requirePlan;
