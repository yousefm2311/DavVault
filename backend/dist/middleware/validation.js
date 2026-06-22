"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEmail = exports.validateBody = void 0;
const validateBody = (requiredFields) => {
    return (req, res, next) => {
        const missingFields = requiredFields.filter((field) => {
            const val = req.body[field];
            return val === undefined || val === null || val === '';
        });
        if (missingFields.length > 0) {
            return res.status(400).json({
                error: `Missing required fields: ${missingFields.join(', ')}`,
            });
        }
        next();
    };
};
exports.validateBody = validateBody;
const validateEmail = (req, res, next) => {
    const { email } = req.body;
    if (!email)
        return next();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email address format.' });
    }
    next();
};
exports.validateEmail = validateEmail;
