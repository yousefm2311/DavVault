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

const paidPlanPricesCents = {
  pro: Number(process.env.STRIPE_PRO_PRICE_AMOUNT_CENTS || 1500),
  team: Number(process.env.STRIPE_TEAM_PRICE_AMOUNT_CENTS || 4900),
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const updateUserRole = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body as { role: 'user' | 'admin' | 'superadmin' };
    if (!['user', 'admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    if (role === 'superadmin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can assign superadmin role.' });
    }

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.role === 'superadmin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can edit superadmin accounts.' });
    }
    if (target._id.toString() === req.user?.id && role === 'user') {
      return res.status(400).json({ error: 'You cannot remove your own admin access.' });
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const updateUserStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: 'active' | 'suspended' | 'pending' };
    if (!['active', 'suspended', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.role === 'superadmin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can edit superadmin accounts.' });
    }
    if (target._id.toString() === req.user?.id && status === 'suspended') {
      return res.status(400).json({ error: 'You cannot suspend your own account.' });
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getUserActivity = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const activities = await Activity.find({ userId: id }).sort({ createdAt: -1 }).limit(100);
    return res.status(200).json({ activities });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const forceDeleteProject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid project id.' });
    }

    const project = await Project.findByIdAndDelete(id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const updatePlanLimits = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limits } = req.body as { limits: Record<string, any> };
    if (!limits || typeof limits !== 'object') {
      return res.status(400).json({ error: 'Limits object is required.' });
    }

    const setting = await AdminSetting.findOneAndUpdate(
      { key: 'plan_limits' },
      { value: limits },
      { upsert: true, new: true }
    );

    await Activity.create({
      userId: req.user!.id,
      action: 'admin_plan_limits_updated',
      entityType: 'auth',
      metadata: { limits },
    });

    return res.status(200).json({ setting });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
