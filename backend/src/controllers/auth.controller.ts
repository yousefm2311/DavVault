import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Workspace, Subscription } from '../models';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

const generateTokens = (user: any) => {
  const accessSecret = process.env.JWT_SECRET || 'devvault_secret_access_token_key_2026';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'devvault_secret_refresh_token_key_2026';

  const accessToken = jwt.sign(
    { id: user._id, email: user.email, plan: user.plan },
    accessSecret,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    refreshSecret,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
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

    // Create default workspace for user
    const defaultWorkspace = await Workspace.create({
      name: `${user.name}'s Brain`,
      ownerId: user._id,
      members: [{ userId: user._id, role: 'owner' }],
    });

    // Create default subscription limits
    await Subscription.create({
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
      devCode: code, // return in dev mode to make testing super smooth
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
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
    const workspace = await Workspace.findOne({ ownerId: user._id });

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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Refresh token is required.' });
    }

    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'devvault_secret_refresh_token_key_2026';
    const decoded = jwt.verify(token, refreshSecret) as { id: string };

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token user.' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    return res.status(200).json({
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error: any) {
    return res.status(403).json({ error: 'Token refresh failed. Invalid refresh token.' });
  }
};

// Social login stub endpoints for dev environment
export const socialLoginStub = async (req: Request, res: Response) => {
  try {
    const { name, email, avatar, provider, providerId } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: 'Name and email are required for social login stub.' });
    }

    let user = await User.findOne({ email });
    let isNew = false;

    if (!user) {
      isNew = true;
      user = await User.create({
        name,
        email,
        avatar,
        plan: 'free',
        isVerified: true, // Social logins are auto-verified
        ...(provider === 'google' ? { googleId: providerId } : { githubId: providerId }),
      });

      // Create defaults
      await Workspace.create({
        name: `${name}'s Brain`,
        ownerId: user._id,
        members: [{ userId: user._id, role: 'owner' }],
      });

      await Subscription.create({
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

    const workspace = await Workspace.findOne({ ownerId: user._id });
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const logout = async (req: Request, res: Response) => {
  return res.status(200).json({ message: 'Logout successful.' });
};
