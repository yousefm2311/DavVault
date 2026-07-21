import { Response } from 'express';
import mongoose from 'mongoose';
import {
  Activity,
  AdminSetting,
  CodeEntity,
  Embedding,
  File as DBFile,
  Project,
  Subscription,
  User,
} from '../models';
import { AuthenticatedRequest } from '../middleware/auth';
import { queueService } from '../services/queue.service';
import { storageService } from '../services/storage.service';
import { notificationService } from '../services/notification.service';
import { isBillablePlan, planLimits } from '../utils/billing';

const paidPlanPricesCents = {
  pro: Number(process.env.STRIPE_PRO_PRICE_AMOUNT_CENTS || 1500),
  team: Number(process.env.STRIPE_TEAM_PRICE_AMOUNT_CENTS || 4900),
};

const isValidAdminObjectId = (value: unknown): value is string => (
  typeof value === 'string' &&
  /^[a-fA-F0-9]{24}$/.test(value) &&
  mongoose.Types.ObjectId.isValid(value)
);

const invalidObjectIdResponse = (res: Response, field = 'id') => res.status(400).json({
  error: `Invalid ${field}.`,
  code: 'INVALID_OBJECT_ID',
});

const adminServerError = (res: Response, code: string) => res.status(500).json({
  error: 'An unexpected admin API error occurred.',
  code,
});

const isSafePlanLimitValue = (value: unknown) => (
  Number.isFinite(value) &&
  Number(value) >= 0 &&
  Number.isInteger(Number(value))
);

const normalizePlanLimits = (limits: Record<string, any>) => {
  const normalized: Record<string, typeof planLimits.free> = {};
  for (const [plan, rawLimits] of Object.entries(limits)) {
    if (!isBillablePlan(plan)) return null;
    if (!rawLimits || typeof rawLimits !== 'object') return null;
    const candidate = {
      projectsCount: Number(rawLimits.projectsCount),
      storageBytes: Number(rawLimits.storageBytes),
      aiQuestionsPerMonth: Number(rawLimits.aiQuestionsPerMonth),
      teamMembers: rawLimits.teamMembers === undefined
        ? planLimits[plan].teamMembers
        : Number(rawLimits.teamMembers),
    };
    if (
      !isSafePlanLimitValue(candidate.projectsCount) ||
      !isSafePlanLimitValue(candidate.storageBytes) ||
      !isSafePlanLimitValue(candidate.aiQuestionsPerMonth) ||
      !isSafePlanLimitValue(candidate.teamMembers)
    ) {
      return null;
    }
    normalized[plan] = candidate;
  }
  return normalized;
};

export const getAdminStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      totalUsers,
      totalProjects,
      activeSubscriptions,
      subscriptionsByPlan,
      storageAgg,
      topStorageUsers,
      queue,
    ] = await Promise.all([
      User.countDocuments(),
      Project.countDocuments(),
      Subscription.countDocuments({ status: 'active', plan: { $in: ['pro', 'team'] } }),
      Subscription.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$plan', count: { $sum: 1 } } },
      ]),
      DBFile.aggregate([{ $group: { _id: null, total: { $sum: '$size' } } }]),
      DBFile.aggregate([
        { $group: { _id: '$userId', storageBytes: { $sum: '$size' }, filesCount: { $sum: 1 } } },
        { $sort: { storageBytes: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            userId: '$_id',
            storageBytes: 1,
            filesCount: 1,
            name: '$user.name',
            email: '$user.email',
            plan: '$user.plan',
          },
        },
      ]),
      queueService.getStats(),
    ]);

    const planCounts = subscriptionsByPlan.reduce<Record<string, number>>((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const estimatedMonthlyRevenueCents =
      (planCounts.pro || 0) * paidPlanPricesCents.pro +
      (planCounts.team || 0) * paidPlanPricesCents.team;

    return res.status(200).json({
      stats: {
        totalUsers,
        totalProjects,
        activeSubscriptions,
        totalStorageBytes: storageAgg[0]?.total || 0,
        estimatedMonthlyRevenueCents,
        stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
        subscriptionsByPlan: {
          free: planCounts.free || 0,
          pro: planCounts.pro || 0,
          team: planCounts.team || 0,
          enterprise: planCounts.enterprise || 0,
        },
        queue,
        topStorageUsers,
      },
    });
  } catch {
    return adminServerError(res, 'ADMIN_STATS_FAILED');
  }
};

export const listAdminUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || '').trim();
    const role = String(req.query.role || '').trim();
    const status = String(req.query.status || '').trim();
    const plan = String(req.query.plan || '').trim();

    const filter: Record<string, any> = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (['user', 'admin', 'superadmin'].includes(role)) filter.role = role;
    if (['active', 'suspended', 'pending'].includes(status)) filter.status = status;
    if (['free', 'pro', 'team', 'enterprise'].includes(plan)) filter.plan = plan;

    const [users, total] = await Promise.all([
      User.find(filter, 'name email avatar plan role status isVerified createdAt updatedAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch {
    return adminServerError(res, 'ADMIN_USERS_LIST_FAILED');
  }
};

export const updateUserRole = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body as { role: 'user' | 'admin' | 'superadmin' };
    if (!isValidAdminObjectId(id)) {
      return invalidObjectIdResponse(res, 'user id');
    }
    if (!['user', 'admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.', code: 'INVALID_ROLE' });
    }
    if (role === 'superadmin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can assign superadmin role.', code: 'SUPERADMIN_REQUIRED' });
    }

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ error: 'User not found.', code: 'USER_NOT_FOUND' });
    if (target.role === 'superadmin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can edit superadmin accounts.', code: 'SUPERADMIN_REQUIRED' });
    }
    if (target._id.toString() === req.user?.id && role === 'user') {
      return res.status(400).json({ error: 'You cannot remove your own admin access.', code: 'SELF_ADMIN_DOWNGRADE_BLOCKED' });
    }

    target.role = role;
    await target.save();

    await notificationService.create({
      userId: target._id,
      title: 'تم تحديث صلاحيات الحساب',
      message: `تم تغيير دور حسابك إلى ${role}.`,
      type: 'info',
      link: '/profile',
    });

    return res.status(200).json({
      user: {
        _id: target._id,
        name: target.name,
        email: target.email,
        avatar: target.avatar,
        plan: target.plan,
        role: target.role,
        status: target.status,
        isVerified: target.isVerified,
        createdAt: target.createdAt,
        updatedAt: target.updatedAt,
      },
    });
  } catch {
    return adminServerError(res, 'ADMIN_ROLE_UPDATE_FAILED');
  }
};

export const updateUserStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: 'active' | 'suspended' | 'pending' };
    if (!isValidAdminObjectId(id)) {
      return invalidObjectIdResponse(res, 'user id');
    }
    if (!['active', 'suspended', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.', code: 'INVALID_STATUS' });
    }

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ error: 'User not found.', code: 'USER_NOT_FOUND' });
    if (target.role === 'superadmin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can edit superadmin accounts.', code: 'SUPERADMIN_REQUIRED' });
    }
    if (target._id.toString() === req.user?.id && status === 'suspended') {
      return res.status(400).json({ error: 'You cannot suspend your own account.', code: 'SELF_SUSPEND_BLOCKED' });
    }

    target.status = status;
    await target.save();

    await notificationService.create({
      userId: target._id,
      title: 'تم تحديث حالة الحساب',
      message: `تم تغيير حالة حسابك إلى ${status}.`,
      type: status === 'suspended' ? 'warning' : 'info',
      link: '/profile',
    });

    return res.status(200).json({
      user: {
        _id: target._id,
        name: target.name,
        email: target.email,
        avatar: target.avatar,
        plan: target.plan,
        role: target.role,
        status: target.status,
        isVerified: target.isVerified,
        createdAt: target.createdAt,
        updatedAt: target.updatedAt,
      },
    });
  } catch {
    return adminServerError(res, 'ADMIN_STATUS_UPDATE_FAILED');
  }
};

export const getUserActivity = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!isValidAdminObjectId(id)) {
      return invalidObjectIdResponse(res, 'user id');
    }
    const activities = await Activity.find({ userId: id }).sort({ createdAt: -1 }).limit(100);
    return res.status(200).json({ activities });
  } catch {
    return adminServerError(res, 'ADMIN_USER_ACTIVITY_FAILED');
  }
};

export const listAdminProjects = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || '').trim();

    const filter: Record<string, any> = {};
    if (search) filter.name = { $regex: search, $options: 'i' };

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .populate('userId', 'name email plan status')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Project.countDocuments(filter),
    ]);

    return res.status(200).json({
      projects,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch {
    return adminServerError(res, 'ADMIN_PROJECTS_LIST_FAILED');
  }
};

export const forceDeleteProject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!isValidAdminObjectId(id)) {
      return invalidObjectIdResponse(res, 'project id');
    }

    const project = await Project.findByIdAndDelete(id);
    if (!project) return res.status(404).json({ error: 'Project not found.', code: 'PROJECT_NOT_FOUND' });

    await Promise.all([
      DBFile.deleteMany({ projectId: id }),
      CodeEntity.deleteMany({ projectId: id }),
      Embedding.deleteMany({ projectId: id }),
      Activity.deleteMany({ entityId: id, entityType: 'project' }),
      storageService.deleteProjectFiles(id),
    ]);

    await Activity.create({
      userId: req.user!.id,
      action: 'admin_project_deleted',
      entityType: 'project',
      entityId: project._id,
      metadata: { projectName: project.name, ownerId: project.userId },
    });

    await notificationService.create({
      userId: project.userId,
      title: 'تم حذف مشروع بواسطة الإدارة',
      message: `تم حذف مشروع ${project.name} بواسطة فريق الإدارة.`,
      type: 'warning',
      link: '/projects',
    });

    return res.status(200).json({ message: 'Project deleted by admin.' });
  } catch {
    return adminServerError(res, 'ADMIN_PROJECT_DELETE_FAILED');
  }
};

export const updatePlanLimits = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limits } = req.body as { limits: Record<string, any> };
    if (!limits || typeof limits !== 'object') {
      return res.status(400).json({ error: 'Limits object is required.', code: 'INVALID_PLAN_LIMITS' });
    }

    const normalizedLimits = normalizePlanLimits(limits);
    if (!normalizedLimits || Object.keys(normalizedLimits).length === 0) {
      return res.status(400).json({ error: 'Plan limits are invalid.', code: 'INVALID_PLAN_LIMITS' });
    }

    const setting = await AdminSetting.findOneAndUpdate(
      { key: 'plan_limits' },
      { value: normalizedLimits },
      { upsert: true, new: true }
    );

    await Activity.create({
      userId: req.user!.id,
      action: 'admin_plan_limits_updated',
      entityType: 'auth',
      metadata: { plans: Object.keys(normalizedLimits) },
    });

    return res.status(200).json({ setting });
  } catch {
    return adminServerError(res, 'ADMIN_PLAN_LIMITS_UPDATE_FAILED');
  }
};
