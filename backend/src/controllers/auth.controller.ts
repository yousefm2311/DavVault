import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User, Workspace, Subscription } from '../models';
import {
  clearRefreshCookie,
  generateTokens,
  readCookie,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
  verifyRefreshToken,
} from '../services/token.service';

const serializeUser = (user: any) => ({
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

const signOAuthState = (provider: 'google' | 'github') => {
  const secret = process.env.JWT_SECRET!;
  const payload = Buffer.from(
    JSON.stringify({
      provider,
      nonce: crypto.randomBytes(16).toString('hex'),
      exp: Date.now() + 10 * 60 * 1000,
    })
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

const verifyOAuthState = (state: string | undefined, provider: 'google' | 'github') => {
  if (!state) return false;
  const [payload, signature] = state.split('.');
  if (!payload || !signature) return false;

  const secret = process.env.JWT_SECRET!;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (
    Buffer.byteLength(signature) !== Buffer.byteLength(expected) ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return false;
  }

  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  return data.provider === provider && typeof data.exp === 'number' && data.exp > Date.now();
};

const ensureUserDefaults = async (user: any) => {
  let workspace = await Workspace.findOne({ ownerId: user._id });
  if (!workspace) {
    workspace = await Workspace.create({
      name: `${user.name}'s Brain`,
      ownerId: user._id,
      members: [{ userId: user._id, role: 'owner' }],
    });
  }

  await Subscription.findOneAndUpdate(
    { userId: user._id },
    {
      $setOnInsert: {
        userId: user._id,
        plan: 'free',
        status: 'active',
        limits: {
          projectsCount: 2,
          storageBytes: 100 * 1024 * 1024,
          aiQuestionsPerMonth: 20,
          teamMembers: 1,
        },
      },
    },
    { upsert: true, new: true }
  );

  return workspace;
};

const upsertOAuthUser = async ({
  provider,
  providerId,
  email,
  name,
  avatar,
}: {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  name: string;
  avatar?: string;
}) => {
  const normalizedEmail = email.toLowerCase().trim();
  const providerField = provider === 'google' ? 'googleId' : 'githubId';

  let user = await User.findOne({
    $or: [{ email: normalizedEmail }, { [providerField]: providerId }],
  });

  if (!user) {
    user = await User.create({
      name,
      email: normalizedEmail,
      avatar,
      plan: 'free',
      isVerified: true,
      [providerField]: providerId,
    });
  } else {
    user.name = user.name || name;
    user.avatar = avatar || user.avatar;
    user.isVerified = true;
    (user as any)[providerField] = providerId;
    await user.save();
  }

  const workspace = await ensureUserDefaults(user);
  return { user, workspace };
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    // Create user (unverified)
    const newUser = await User.create({
      name,
      email: normalizedEmail,
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
      requiresVerification: true
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const verifyCode = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
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
    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      message: 'Account verified successfully.',
      user: serializeUser(user),
      workspaceId: defaultWorkspace._id,
      accessToken,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const resendCode = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
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
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const requestPasswordReset = async (req: Request, res: Response) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const user = await User.findOne({ email }).select('+passwordResetTokenHash +passwordResetExpires');
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    console.log(`[EMAIL OUTBOX] Password reset URL: ${getFrontendUrl()}/reset-password?email=${encodeURIComponent(email)}&token=${token}`);
  }
  return res.status(200).json({
    message: 'If the account exists, a password reset link has been sent.',
  });
};

export const resetPassword = async (req: Request, res: Response) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const tokenHash = crypto.createHash('sha256').update(String(req.body.token || '')).digest('hex');
  const user = await User.findOne({
    email,
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpires');
  if (!user) return res.status(400).json({ error: 'Invalid or expired password reset link.' });

  user.passwordHash = await bcrypt.hash(req.body.password, 10);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  clearRefreshCookie(res);
  return res.status(200).json({ message: 'Password reset successfully.' });
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
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
        email: user.email
      });
    }

    // Get default workspace
    const workspace = await Workspace.findOne({ ownerId: user._id });

    const { accessToken, refreshToken } = generateTokens(user);
    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      message: 'Login successful.',
      user: serializeUser(user),
      workspaceId: workspace?._id || null,
      accessToken,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const token =
      readCookie(req.headers.cookie, REFRESH_COOKIE_NAME) ||
      (process.env.NODE_ENV !== 'production' ? req.body?.token : undefined);
    if (!token) {
      return res.status(400).json({ error: 'Refresh token is required.' });
    }

    const decoded = verifyRefreshToken(token);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token user.' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact support.' });
    }
    if (decoded.tokenVersion !== (user.tokenVersion || 0)) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Session revoked.' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    setRefreshCookie(res, newRefreshToken);
    const workspace = await Workspace.findOne({
      $or: [{ ownerId: user._id }, { 'members.userId': user._id }],
    }).select('_id');

    return res.status(200).json({
      user: serializeUser(user),
      workspaceId: workspace?._id || null,
      accessToken,
    });
  } catch (error: any) {
    return res.status(403).json({ error: 'Token refresh failed. Invalid refresh token.' });
  }
};

export const startOAuth = async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider as 'google' | 'github';
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const oauthCallback = async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider as 'google' | 'github';
    const code = req.query.code as string;
    const state = req.query.state as string | undefined;
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
      const tokenData: any = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error_description || 'Google token exchange failed.');

      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profile: any = await profileRes.json();
      if (!profileRes.ok || !profile.email) throw new Error('Google profile fetch failed.');

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

      const { refreshToken } = generateTokens(user);
      setRefreshCookie(res, refreshToken);
      return res.redirect(`${getFrontendUrl()}/auth/oauth/callback`);
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
      const tokenData: any = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) throw new Error(tokenData.error_description || 'GitHub token exchange failed.');

      const [profileRes, emailsRes] = await Promise.all([
        fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' },
        }),
        fetch('https://api.github.com/user/emails', {
          headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' },
        }),
      ]);
      const profile: any = await profileRes.json();
      const emails = (await emailsRes.json()) as any[];
      const primaryEmail = emails.find((entry) => entry.primary && entry.verified)?.email || profile.email;
      if (!profileRes.ok || !primaryEmail) throw new Error('GitHub profile email fetch failed.');

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

      const { refreshToken } = generateTokens(user);
      setRefreshCookie(res, refreshToken);
      return res.redirect(`${getFrontendUrl()}/auth/oauth/callback`);
    }

    return res.redirect(`${getFrontendUrl()}/login?oauth_error=unsupported_provider`);
  } catch (error: any) {
    console.error('[OAuth]: Callback failed:', error);
    return res.redirect(`${getFrontendUrl()}/login?oauth_error=callback_failed`);
  }
};

export const logout = async (req: Request, res: Response) => {
  const token = readCookie(req.headers.cookie, REFRESH_COOKIE_NAME);
  if (token) {
    try {
      const decoded = verifyRefreshToken(token);
      await User.findByIdAndUpdate(decoded.id, { $inc: { tokenVersion: 1 } });
    } catch {
      // Invalid or expired cookies are cleared below.
    }
  }
  clearRefreshCookie(res);
  return res.status(200).json({ message: 'Logout successful.' });
};
