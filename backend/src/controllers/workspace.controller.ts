import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { Workspace, User } from '../models';

export const getWorkspaceMembers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    
    // Find workspace owned by user or containing them
    const workspace = await Workspace.findOne({
      $or: [
        { ownerId: req.user.id },
        { 'members.userId': req.user.id }
      ]
    }).populate('members.userId', 'name email avatar plan');

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }

    return res.status(200).json({ workspace });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const addWorkspaceMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Teammate email is required.' });
    }

    // Find the workspace
    const workspace = await Workspace.findOne({ ownerId: req.user.id });
    if (!workspace) {
      return res.status(403).json({ error: 'Only workspace owners can add members.' });
    }

    // Find user to add
    const targetUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (!targetUser) {
      return res.status(404).json({ error: 'No DevVault AI user found with this email.' });
    }

    // Check if already in workspace
    const isMember = workspace.members.some(m => m.userId.toString() === targetUser._id.toString());
    if (isMember) {
      return res.status(400).json({ error: 'User is already a member of this workspace.' });
    }

    // Add to members array
    workspace.members.push({
      userId: targetUser._id,
      role: role || 'member',
    });

    await workspace.save();

    return res.status(200).json({
      message: 'Teammate added to workspace successfully.',
      member: {
        userId: {
          id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          avatar: targetUser.avatar,
        },
        role: role || 'member',
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
