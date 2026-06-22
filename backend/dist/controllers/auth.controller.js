"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.socialLoginStub = exports.refresh = exports.login = exports.resendCode = exports.verifyCode = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const models_1 = require("../models");
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const generateTokens = (user) => {
    const accessSecret = process.env.JWT_SECRET || 'devvault_secret_access_token_key_2026';
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'devvault_secret_refresh_token_key_2026';
    const accessToken = jsonwebtoken_1.default.sign({ id: user._id, email: user.email, plan: user.plan }, accessSecret, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = jsonwebtoken_1.default.sign({ id: user._id }, refreshSecret, { expiresIn: REFRESH_TOKEN_EXPIRY });
    return { accessToken, refreshToken };
};
const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        // Check if user exists
        const existingUser = await models_1.User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered.' });
        }
        // Hash password
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(password, salt);
        // Generate 6-digit verification code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
        // Create user (unverified)
        const newUser = await models_1.User.create({
            name,
            email,
            passwordHash,
            plan: 'free',
            isVerified: false,
            verificationCode: code,
            verificationCodeExpires: expiry
        });
        // Simulate sending email via Terminal console logs
        console.log(`
    ==================================================
    📧 [EMAIL OUTBOX] Verification Code Sent (REGISTRATION)
    To: ${newUser.email}
    Subject: Verify your DevVault AI Account
    Body: Your verification code is: ${code}
    Expires: in 15 minutes.
    ==================================================
    `);
        return res.status(201).json({
            message: 'Registration successful. A verification code has been sent to your email.',
            email: newUser.email,
            requiresVerification: true,
            devCode: code // Returned for smooth developer sandboxing
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.register = register;
const verifyCode = async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            return res.status(400).json({ error: 'Email and verification code are required.' });
        }
        const user = await models_1.User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        if (user.isVerified) {
            return res.status(400).json({ error: 'Account is already verified. You can login.' });
        }
        if (user.verificationCode !== code) {
            return res.status(400).json({ error: 'Invalid verification code.' });
        }
        if (user.verificationCodeExpires && user.verificationCodeExpires < new Date()) {
            return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
        }
        // Verify user
        user.isVerified = true;
        user.verificationCode = undefined;
        user.verificationCodeExpires = undefined;
        await user.save();
        // Create default workspace for user
        const defaultWorkspace = await models_1.Workspace.create({
            name: `${user.name}'s Brain`,
            ownerId: user._id,
            members: [{ userId: user._id, role: 'owner' }],
        });
        // Create default subscription limits
        await models_1.Subscription.create({
            userId: user._id,
            plan: 'free',
            status: 'active',
            limits: {
                projectsCount: 2,
                storageBytes: 100 * 1024 * 1024, // 100MB
                aiQuestionsPerMonth: 20,
            },
        });
        const { accessToken, refreshToken } = generateTokens(user);
        return res.status(200).json({
            message: 'Account verified successfully.',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                plan: user.plan,
                avatar: user.avatar,
            },
            workspaceId: defaultWorkspace._id,
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.verifyCode = verifyCode;
const resendCode = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required.' });
        }
        const user = await models_1.User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        if (user.isVerified) {
            return res.status(400).json({ error: 'Account is already verified.' });
        }
        // Generate new code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        user.verificationCode = code;
        user.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry
        await user.save();
        // Log the simulated email sending
        console.log(`
    ==================================================
    📧 [EMAIL OUTBOX] Verification Code Sent (RESEND)
    To: ${user.email}
    Subject: Verify your DevVault AI Account
    Body: Your verification code is: ${code}
    Expires: in 15 minutes.
    ==================================================
    `);
        return res.status(200).json({
            message: 'A new verification code has been sent to your email.',
            devCode: code, // return in dev mode to make testing super smooth
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.resendCode = resendCode;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await models_1.User.findOne({ email });
        if (!user || !user.passwordHash) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }
        // Enforce verification check
        if (!user.isVerified) {
            const code = user.verificationCode || Math.floor(100000 + Math.random() * 900000).toString();
            if (!user.verificationCode) {
                user.verificationCode = code;
                user.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
                await user.save();
            }
            return res.status(403).json({
                error: 'Account not verified. Please verify your email first.',
                requiresVerification: true,
                email: user.email,
                devCode: code
            });
        }
        // Get default workspace
        const workspace = await models_1.Workspace.findOne({ ownerId: user._id });
        const { accessToken, refreshToken } = generateTokens(user);
        return res.status(200).json({
            message: 'Login successful.',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                plan: user.plan,
                avatar: user.avatar,
            },
            workspaceId: workspace?._id || null,
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.login = login;
const refresh = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ error: 'Refresh token is required.' });
        }
        const refreshSecret = process.env.JWT_REFRESH_SECRET || 'devvault_secret_refresh_token_key_2026';
        const decoded = jsonwebtoken_1.default.verify(token, refreshSecret);
        const user = await models_1.User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ error: 'Invalid token user.' });
        }
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
        return res.status(200).json({
            accessToken,
            refreshToken: newRefreshToken,
        });
    }
    catch (error) {
        return res.status(403).json({ error: 'Token refresh failed. Invalid refresh token.' });
    }
};
exports.refresh = refresh;
// Social login stub endpoints for dev environment
const socialLoginStub = async (req, res) => {
    try {
        const { name, email, avatar, provider, providerId } = req.body;
        if (!email || !name) {
            return res.status(400).json({ error: 'Name and email are required for social login stub.' });
        }
        let user = await models_1.User.findOne({ email });
        let isNew = false;
        if (!user) {
            isNew = true;
            user = await models_1.User.create({
                name,
                email,
                avatar,
                plan: 'free',
                isVerified: true, // Social logins are auto-verified
                ...(provider === 'google' ? { googleId: providerId } : { githubId: providerId }),
            });
            // Create defaults
            await models_1.Workspace.create({
                name: `${name}'s Brain`,
                ownerId: user._id,
                members: [{ userId: user._id, role: 'owner' }],
            });
            await models_1.Subscription.create({
                userId: user._id,
                plan: 'free',
                status: 'active',
                limits: {
                    projectsCount: 2,
                    storageBytes: 100 * 1024 * 1024,
                    aiQuestionsPerMonth: 20,
                },
            });
        }
        const workspace = await models_1.Workspace.findOne({ ownerId: user._id });
        const { accessToken, refreshToken } = generateTokens(user);
        return res.status(isNew ? 201 : 200).json({
            message: `Logged in via ${provider} successfully.`,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                plan: user.plan,
                avatar: user.avatar,
            },
            workspaceId: workspace?._id || null,
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.socialLoginStub = socialLoginStub;
const logout = async (req, res) => {
    return res.status(200).json({ message: 'Logout successful.' });
};
exports.logout = logout;
