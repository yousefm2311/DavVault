import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { User, Workspace } from '../models';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

const generateTokens = (user: any) => {
  const accessSecret = process.env.JWT_SECRET || 'devvault_secret_access_token_key_2026';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'devvault_secret_refresh_token_key_2026';

  const accessToken = jwt.sign(
    { id: user._id, email: user.email, plan: user.plan, role: user.role || 'user' },
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

const serializeUser = (user: any) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  bio: user.bio,
  plan: user.plan || 'free',
  role: user.role || 'user',
  status: user.status || 'active',
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    const user = await User.findById(req.user.id).select('-passwordHash -verificationCode -verificationCodeExpires');
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const workspace = await Workspace.findOne({
      $or: [{ ownerId: user._id }, { 'members.userId': user._id }],
    }).select('_id');

    return res.status(200).json({
      user: serializeUser(user),
      workspaceId: workspace?._id || null,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    const { name, email, avatar, bio, currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // 1. Update personal details
    if (name) user.name = name.trim();
    if (avatar) user.avatar = avatar;
    if (bio !== undefined) user.bio = bio.trim();

    // 2. Email updates
    let emailChanged = false;
    if (email && email.toLowerCase().trim() !== user.email) {
      const emailLower = email.toLowerCase().trim();
      // Check if email already exists
      const existingUser = await User.findOne({ email: emailLower });
      if (existingUser) {
        return res.status(400).json({ error: 'Email address is already in use by another account.' });
      }
      user.email = emailLower;
      emailChanged = true;
    }

    // 3. Password updates
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to change password.' });
      }
      
      if (user.passwordHash) {
        const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isMatch) {
          return res.status(400).json({ error: 'Incorrect current password.' });
        }
      }
      
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(newPassword, salt);
    }

    await user.save();

    // Generate fresh tokens if email changed
    let tokens = null;
    if (emailChanged) {
      tokens = generateTokens(user);
    }

    return res.status(200).json({
      message: 'Profile updated successfully.',
      user: serializeUser(user),
      ...(tokens ? { tokens } : {})
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
