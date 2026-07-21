import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth';
import { Workspace, User } from '../models';
import { notificationService } from '../services/notification.service';
import { buildSubscriptionPayload, isValidMongoId } from '../utils/billing';

type WorkspaceRole = 'owner' | 'admin' | 'member';

const invalidIdResponse = (res: Response, field: string) => res.status(400).json({
  error: `Invalid ${field}.`,
  code: 'INVALID_OBJECT_ID',
});

const serverErrorResponse = (res: Response, code: string) => res.status(500).json({
  error: 'An unexpected workspace API error occurred.',
  code,
});

const normalizeMemberRole = (value: unknown): Exclude<WorkspaceRole, 'owner'> | null => {
  if (value === undefined || value === null || value === '') return 'member';
  return value === 'admin' || value === 'member' ? value : null;
};

const normalizeEmail = (value: unknown) => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

const isWorkspaceManager = (workspace: any, userId: string) => (
  workspace.ownerId?.toString() === userId ||
  workspace.members?.some((member: any) => (
    member.userId?.toString() === userId && member.role === 'admin'
  ))
);

const findVisibleWorkspace = (userId: string) => Workspace.findOne({
  $or: [
    { ownerId: userId },
    { 'members.userId': userId },
  ],
}).populate('members.userId', 'name email avatar plan status');

const findManagedWorkspace = async (userId: string) => {
  const workspace = await Workspace.findOne({
    $or: [
      { ownerId: userId },
      { members: { $elemMatch: { userId: new Types.ObjectId(userId), role: 'admin' } } },
    ],
  });
  return workspace && isWorkspaceManager(workspace, userId) ? workspace : null;
};

const memberLimitResponse = (res: Response, payload: Awaited<ReturnType<typeof buildSubscriptionPayload>>) => (
  res.status(403).json({
    error: `Your subscription plan (${payload.plan.toUpperCase()}) allows up to ${payload.limits.teamMembers} workspace members.`,
    code: 'LIMIT_EXCEEDED',
    resource: 'teamMembers',
    plan: payload.plan,
    status: payload.status,
    limit: payload.limits.teamMembers,
    current: payload.usage.teamMembers,
    remaining: payload.remaining.teamMembers,
    resetAt: payload.resetAt,
    isLocalSimulation: payload.isLocalSimulation,
  })
);

export const getWorkspaceMembers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    if (!isValidMongoId(req.user.id)) return invalidIdResponse(res, 'user id');

    const workspace = await findVisibleWorkspace(req.user.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found.', code: 'WORKSPACE_NOT_FOUND' });
    }

    const billingOwnerId = workspace.ownerId?.toString();
    const billing = billingOwnerId && isValidMongoId(billingOwnerId)
      ? await buildSubscriptionPayload(billingOwnerId)
      : null;

    return res.status(200).json({
      workspace,
      memberLimit: billing ? {
        limit: billing.limits.teamMembers,
        current: billing.usage.teamMembers,
        remaining: billing.remaining.teamMembers,
        plan: billing.plan,
        status: billing.status,
        isLocalSimulation: billing.isLocalSimulation,
      } : undefined,
      canManageMembers: isWorkspaceManager(workspace, req.user.id),
    });
  } catch {
    return serverErrorResponse(res, 'WORKSPACE_MEMBERS_READ_FAILED');
  }
};

export const addWorkspaceMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    if (!isValidMongoId(req.user.id)) return invalidIdResponse(res, 'user id');

    const email = normalizeEmail(req.body?.email);
    const role = normalizeMemberRole(req.body?.role);
    if (!email) {
      return res.status(400).json({ error: 'Teammate email is required.', code: 'MEMBER_EMAIL_REQUIRED' });
    }
    if (!role) {
      return res.status(400).json({ error: 'Invalid workspace role.', code: 'INVALID_MEMBER_ROLE' });
    }

    const workspace = await findManagedWorkspace(req.user.id);
    if (!workspace) {
      return res.status(403).json({ error: 'Only workspace owners or admins can add members.', code: 'FORBIDDEN' });
    }

    const ownerId = workspace.ownerId.toString();
    const billing = await buildSubscriptionPayload(ownerId);
    if (workspace.members.length >= billing.limits.teamMembers) {
      return memberLimitResponse(res, billing);
    }

    const targetUser = await User.findOne({ email }, 'name email avatar plan status').lean();
    if (!targetUser) {
      return res.status(404).json({ error: 'No DevVault AI user found with this email.', code: 'USER_NOT_FOUND' });
    }
    if ((targetUser as any).status !== 'active') {
      return res.status(403).json({ error: 'This user cannot be added to a workspace.', code: 'USER_NOT_ACTIVE' });
    }

    const targetUserId = (targetUser as any)._id.toString();
    const isMember = workspace.members.some((member) => member.userId.toString() === targetUserId);
    if (isMember) {
      return res.status(409).json({ error: 'User is already a member of this workspace.', code: 'DUPLICATE_MEMBER' });
    }

    workspace.members.push({
      userId: (targetUser as any)._id,
      role,
    });
    await workspace.save();

    await Promise.all([
      notificationService.create({
        userId: (targetUser as any)._id,
        title: 'تمت إضافتك إلى مساحة عمل',
        message: `تمت إضافتك إلى مساحة ${workspace.name} بدور ${role}.`,
        type: 'info',
        link: '/team',
      }),
      notificationService.create({
        userId: req.user.id,
        title: 'تمت إضافة عضو جديد',
        message: `تمت إضافة ${(targetUser as any).name} إلى مساحة العمل بنجاح.`,
        type: 'success',
        link: '/team',
      }),
    ]);

    return res.status(200).json({
      message: 'Teammate added to workspace successfully.',
      member: {
        userId: {
          id: (targetUser as any)._id.toString(),
          _id: (targetUser as any)._id.toString(),
          name: (targetUser as any).name,
          email: (targetUser as any).email,
          avatar: (targetUser as any).avatar,
        },
        role,
      },
    });
  } catch {
    return serverErrorResponse(res, 'WORKSPACE_MEMBER_ADD_FAILED');
  }
};

export const updateWorkspaceMemberRole = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    if (!isValidMongoId(req.user.id)) return invalidIdResponse(res, 'user id');
    if (!isValidMongoId(req.params.userId)) return invalidIdResponse(res, 'member id');

    const role = normalizeMemberRole(req.body?.role);
    if (!role) {
      return res.status(400).json({ error: 'Invalid workspace role.', code: 'INVALID_MEMBER_ROLE' });
    }

    const workspace = await findManagedWorkspace(req.user.id);
    if (!workspace) {
      return res.status(403).json({ error: 'Only workspace owners or admins can update member roles.', code: 'FORBIDDEN' });
    }

    const member = workspace.members.find((entry) => entry.userId.toString() === req.params.userId);
    if (!member) {
      return res.status(404).json({ error: 'Workspace member not found.', code: 'MEMBER_NOT_FOUND' });
    }
    if (member.role === 'owner') {
      return res.status(400).json({ error: 'Workspace owner role cannot be changed.', code: 'OWNER_ROLE_CHANGE_BLOCKED' });
    }

    member.role = role;
    await workspace.save();
    return res.status(200).json({ message: 'Workspace member role updated.', member: { userId: req.params.userId, role } });
  } catch {
    return serverErrorResponse(res, 'WORKSPACE_MEMBER_ROLE_UPDATE_FAILED');
  }
};

export const removeWorkspaceMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    if (!isValidMongoId(req.user.id)) return invalidIdResponse(res, 'user id');
    if (!isValidMongoId(req.params.userId)) return invalidIdResponse(res, 'member id');

    const workspace = await findManagedWorkspace(req.user.id);
    if (!workspace) {
      return res.status(403).json({ error: 'Only workspace owners or admins can remove members.', code: 'FORBIDDEN' });
    }

    const member = workspace.members.find((entry) => entry.userId.toString() === req.params.userId);
    if (!member) {
      return res.status(404).json({ error: 'Workspace member not found.', code: 'MEMBER_NOT_FOUND' });
    }
    if (member.role === 'owner' || workspace.ownerId.toString() === req.params.userId) {
      return res.status(400).json({ error: 'Workspace owner cannot be removed.', code: 'OWNER_REMOVE_BLOCKED' });
    }

    workspace.members = workspace.members.filter((entry) => entry.userId.toString() !== req.params.userId);
    await workspace.save();

    void notificationService.create({
      userId: req.params.userId,
      title: 'تمت إزالتك من مساحة عمل',
      message: `تمت إزالة عضويتك من مساحة ${workspace.name}.`,
      type: 'warning',
      link: '/team',
    }).catch(() => undefined);

    return res.status(200).json({ message: 'Workspace member removed.' });
  } catch {
    return serverErrorResponse(res, 'WORKSPACE_MEMBER_REMOVE_FAILED');
  }
};
