import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { Workspace, User } from '../models';
import { notificationService } from '../services/notification.service';

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

    await Promise.all([
      notificationService.create({
        userId: targetUser._id,
        title: 'تمت إضافتك إلى مساحة عمل',
        message: `تمت إضافتك إلى مساحة ${workspace.name} بدور ${role || 'member'}.`,
        type: 'info',
        link: '/team',
      }),
      notificationService.create({
        userId: req.user.id,
        title: 'تمت إضافة عضو جديد',
        message: `تمت إضافة ${targetUser.name} إلى مساحة العمل بنجاح.`,
        type: 'success',
        link: '/team',
      }),
    ]);

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

export const removeWorkspaceMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const workspace = await Workspace.findOne({ ownerId: req.user.id });
    if (!workspace) return res.status(403).json({ error: 'Only workspace owners can remove members.' });

    const member = workspace.members.find(
      (entry) => entry.userId.toString() === req.params.userId
    );
    if (!member || member.role === 'owner') {
      return res.status(400).json({ error: 'Workspace member cannot be removed.' });
    }

    workspace.members = workspace.members.filter(
      (entry) => entry.userId.toString() !== req.params.userId
    );
    await workspace.save();
    return res.status(200).json({ message: 'Workspace member removed.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
