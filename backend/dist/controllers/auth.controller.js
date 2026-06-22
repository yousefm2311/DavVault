"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.oauthCallback = exports.startOAuth = exports.socialLoginStub = exports.refresh = exports.login = exports.resendCode = exports.verifyCode = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const models_1 = require("../models");
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const generateTokens = (user) => {
    const accessSecret = process.env.JWT_SECRET || 'devvault_secret_access_token_key_2026';
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'devvault_secret_refresh_token_key_2026';
    const accessToken = jsonwebtoken_1.default.sign({ id: user._id, email: user.email, plan: user.plan, role: user.role || 'user' }, accessSecret, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = jsonwebtoken_1.default.sign({ id: user._id }, refreshSecret, { expiresIn: REFRESH_TOKEN_EXPIRY });
    return { accessToken, refreshToken };
};
const serializeUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    plan: user.plan,
    role: user.role || 'user',
    status: user.status || 'active',
    avatar: user.avatar,
    bio: user.bio,
    createdAt: user.createdAt,
});
const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:3000';
const signOAuthState = (provider) => {
    const secret = process.env.JWT_SECRET || 'devvault-secret';
    const payload = Buffer.from(JSON.stringify({
        provider,
        nonce: crypto_1.default.randomBytes(16).toString('hex'),
        exp: Date.now() + 10 * 60 * 1000,
    })).toString('base64url');
    const signature = crypto_1.default.createHmac('sha256', secret).update(payload).digest('base64url');
    return `${payload}.${signature}`;
};
const verifyOAuthState = (state, provider) => {
    if (!state)
        return false;
    const [payload, signature] = state.split('.');
    if (!payload || !signature)
        return false;
    const secret = process.env.JWT_SECRET || 'devvault-secret';
    const expected = crypto_1.default.createHmac('sha256', secret).update(payload).digest('base64url');
    if (Buffer.byteLength(signature) !== Buffer.byteLength(expected) ||
        !crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return false;
    }
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.provider === provider && typeof data.exp === 'number' && data.exp > Date.now();
};
const ensureUserDefaults = async (user) => {
    let workspace = await models_1.Workspace.findOne({ ownerId: user._id });
    if (!workspace) {
        workspace = await models_1.Workspace.create({
            name: `${user.name}'s Brain`,
            ownerId: user._id,
            members: [{ userId: user._id, role: 'owner' }],
        });
    }
    await models_1.Subscription.findOneAndUpdate({ userId: user._id }, {
        $setOnInsert: {
            userId: user._id,
            plan: 'free',
            status: 'active',
            limits: {
                projectsCount: 2,
                storageBytes: 100 * 1024 * 1024,
                aiQuestionsPerMonth: 20,
            },
        },
    }, { upsert: true, new: true });
    return workspace;
};
const buildOAuthCallbackRedirect = (user, workspaceId) => {
    const { accessToken, refreshToken } = generateTokens(user);
    const payload = Buffer.from(JSON.stringify({
        user: {
            ...serializeUser(user),
        },
        workspaceId,
        accessToken,
        refreshToken,
    })).toString('base64url');
    return `${getFrontendUrl()}/auth/oauth/callback#payload=${payload}`;
};
const upsertOAuthUser = async ({ provider, providerId, email, name, avatar, }) => {
    const normalizedEmail = email.toLowerCase().trim();
    const providerField = provider === 'google' ? 'googleId' : 'githubId';
    let user = await models_1.User.findOne({
        $or: [{ email: normalizedEmail }, { [providerField]: providerId }],
    });
    if (!user) {
        user = await models_1.User.create({
            name,
            email: normalizedEmail,
            avatar,
            plan: 'free',
            isVerified: true,
            [providerField]: providerId,
        });
    }
    else {
        user.name = user.name || name;
        user.avatar = avatar || user.avatar;
        user.isVerified = true;
        user[providerField] = providerId;
        await user.save();
    }
    const workspace = await ensureUserDefaults(user);
    return { user, workspace };
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
        const defaultWorkspace = await ensureUserDefaults(user);
        const { accessToken, refreshToken } = generateTokens(user);
        return res.status(200).json({
            message: 'Account verified successfully.',
            user: serializeUser(user),
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
        if (user.status === 'suspended') {
            return res.status(403).json({ error: 'Account suspended. Contact support.' });
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
            user: serializeUser(user),
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
        if (user.status === 'suspended') {
            return res.status(403).json({ error: 'Account suspended. Contact support.' });
        }
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
        const workspace = await models_1.Workspace.findOne({
            $or: [{ ownerId: user._id }, { 'members.userId': user._id }],
        }).select('_id');
        return res.status(200).json({
            user: serializeUser(user),
            workspaceId: workspace?._id || null,
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
        }
        if (user.status === 'suspended') {
            return res.status(403).json({ error: 'Account suspended. Contact support.' });
        }
        const workspace = await ensureUserDefaults(user);
        const { accessToken, refreshToken } = generateTokens(user);
        return res.status(isNew ? 201 : 200).json({
            message: `Logged in via ${provider} successfully.`,
            user: serializeUser(user),
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
const startOAuth = async (req, res) => {
    try {
        const provider = req.params.provider;
        const state = signOAuthState(provider);
        const apiBase = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5001}`;
        const redirectUri = `${apiBase}/api/auth/oauth/${provider}/callback`;
        if (provider === 'google') {
            if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
                return res.redirect(`${getFrontendUrl()}/login?oauth_error=google_not_configured`);
            }
            const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
            url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
            url.searchParams.set('redirect_uri', redirectUri);
            url.searchParams.set('response_type', 'code');
            url.searchParams.set('scope', 'openid email profile');
            url.searchParams.set('state', state);
            url.searchParams.set('prompt', 'select_account');
            return res.redirect(url.toString());
        }
        if (provider === 'github') {
            if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
                return res.redirect(`${getFrontendUrl()}/login?oauth_error=github_not_configured`);
            }
            const url = new URL('https://github.com/login/oauth/authorize');
            url.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID);
            url.searchParams.set('redirect_uri', redirectUri);
            url.searchParams.set('scope', 'read:user user:email');
            url.searchParams.set('state', state);
            return res.redirect(url.toString());
        }
        return res.status(400).json({ error: 'Unsupported OAuth provider.' });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.startOAuth = startOAuth;
const oauthCallback = async (req, res) => {
    try {
        const provider = req.params.provider;
        const code = req.query.code;
        const state = req.query.state;
        if (!code) {
            return res.redirect(`${getFrontendUrl()}/login?oauth_error=missing_code`);
        }
        if (!verifyOAuthState(state, provider)) {
            return res.redirect(`${getFrontendUrl()}/login?oauth_error=invalid_state`);
        }
        const apiBase = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5001}`;
        const redirectUri = `${apiBase}/api/auth/oauth/${provider}/callback`;
        if (provider === 'google') {
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: process.env.GOOGLE_CLIENT_ID || '',
                    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: redirectUri,
                }),
            });
            const tokenData = await tokenRes.json();
            if (!tokenRes.ok)
                throw new Error(tokenData.error_description || 'Google token exchange failed.');
            const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            const profile = await profileRes.json();
            if (!profileRes.ok || !profile.email)
                throw new Error('Google profile fetch failed.');
            const { user, workspace } = await upsertOAuthUser({
                provider: 'google',
                providerId: profile.id,
                email: profile.email,
                name: profile.name || profile.email.split('@')[0],
                avatar: profile.picture,
            });
            if (user.status === 'suspended') {
                return res.redirect(`${getFrontendUrl()}/login?oauth_error=account_suspended`);
            }
            return res.redirect(buildOAuthCallbackRedirect(user, workspace._id.toString()));
        }
        if (provider === 'github') {
            const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: process.env.GITHUB_CLIENT_ID,
                    client_secret: process.env.GITHUB_CLIENT_SECRET,
                    code,
                    redirect_uri: redirectUri,
                }),
            });
            const tokenData = await tokenRes.json();
            if (!tokenRes.ok || !tokenData.access_token)
                throw new Error(tokenData.error_description || 'GitHub token exchange failed.');
            const [profileRes, emailsRes] = await Promise.all([
                fetch('https://api.github.com/user', {
                    headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' },
                }),
                fetch('https://api.github.com/user/emails', {
                    headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' },
                }),
            ]);
            const profile = await profileRes.json();
            const emails = (await emailsRes.json());
            const primaryEmail = emails.find((entry) => entry.primary && entry.verified)?.email || profile.email;
            if (!profileRes.ok || !primaryEmail)
                throw new Error('GitHub profile email fetch failed.');
            const { user, workspace } = await upsertOAuthUser({
                provider: 'github',
                providerId: String(profile.id),
                email: primaryEmail,
                name: profile.name || profile.login || primaryEmail.split('@')[0],
                avatar: profile.avatar_url,
            });
            if (user.status === 'suspended') {
                return res.redirect(`${getFrontendUrl()}/login?oauth_error=account_suspended`);
            }
            return res.redirect(buildOAuthCallbackRedirect(user, workspace._id.toString()));
        }
        return res.redirect(`${getFrontendUrl()}/login?oauth_error=unsupported_provider`);
    }
    catch (error) {
        console.error('[OAuth]: Callback failed:', error);
        return res.redirect(`${getFrontendUrl()}/login?oauth_error=callback_failed`);
    }
};
exports.oauthCallback = oauthCallback;
const logout = async (req, res) => {
    return res.status(200).json({ message: 'Logout successful.' });
};
exports.logout = logout;
