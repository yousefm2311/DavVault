"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanForSecrets = exports.safePathResolve = exports.authLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
// Rate Limiter to protect against API abuse (brute force)
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 15, // Limit each IP to 15 authentication attempts per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts, please try again in an hour.' },
});
// Sanitizes and validates directory paths to prevent Zip Slip (Directory Traversal)
const safePathResolve = (baseDir, relativePath) => {
    const resolvedPath = path_1.default.resolve(baseDir, relativePath);
    // Verify that the resolved path is indeed inside the baseDir
    if (!resolvedPath.startsWith(path_1.default.resolve(baseDir))) {
        throw new Error('Directory traversal attack detected!');
    }
    return resolvedPath;
};
exports.safePathResolve = safePathResolve;
// Scan code for potential secrets (AWS keys, OpenAI keys, JWT keys, database passwords)
const scanForSecrets = (content) => {
    const secretPatterns = [
        { name: 'OpenAI API Key', regex: /sk-[a-zA-Z0-9]{32,48}/g },
        { name: 'Google API Key', regex: /AIzaSy[a-zA-Z0-9_-]{33}/g },
        { name: 'Generic Password/Secret Key', regex: /(?:key|secret|password|passwd|token|auth|credential)(?:\s*[:=]\s*["'])([a-zA-Z0-9_\-\.\@\#\$\%\^\&\*\(\)\+]{8,64})(?=["'])/gi },
        { name: 'Slack Webhook', regex: /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]{8}\/B[a-zA-Z0-9_]{8}\/[a-zA-Z0-9_]{24}/g },
        { name: 'AWS Access Key ID', regex: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|APKA|ASCA|ASIA)[A-Z0-9]{16}/g }
    ];
    let hasSecret = false;
    let redacted = content;
    const detectedSecrets = [];
    for (const pattern of secretPatterns) {
        const matches = content.match(pattern.regex);
        if (matches) {
            hasSecret = true;
            for (const match of matches) {
                // Redact matches except for variables name in key-value matching
                if (pattern.name === 'Generic Password/Secret Key') {
                    // Keep the variable name and replace only the matched secret value
                    const parts = match.split(/[:=]/);
                    if (parts.length > 1) {
                        const redactedValue = parts[0] + ' = "[REDACTED_DEV_VAULT]"';
                        redacted = redacted.replace(match, redactedValue);
                        detectedSecrets.push(`${pattern.name} (redacted key value)`);
                    }
                }
                else {
                    redacted = redacted.replace(match, '[REDACTED_DEV_VAULT]');
                    detectedSecrets.push(pattern.name);
                }
            }
        }
    }
    return { hasSecret, redacted, detectedSecrets };
};
exports.scanForSecrets = scanForSecrets;
