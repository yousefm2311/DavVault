"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePlanLimits = exports.forceDeleteProject = exports.listAdminProjects = exports.getUserActivity = exports.updateUserStatus = exports.updateUserRole = exports.listAdminUsers = exports.getAdminStats = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../models");
const queue_service_1 = require("../services/queue.service");
const storage_service_1 = require("../services/storage.service");
const notification_service_1 = require("../services/notification.service");
const paidPlanPricesCents = {
    pro: Number(process.env.STRIPE_PRO_PRICE_AMOUNT_CENTS || 1500),
    team: Number(process.env.STRIPE_TEAM_PRICE_AMOUNT_CENTS || 4900),
};
const getAdminStats = async (req, res) => {
    try {
        const [totalUsers, totalProjects, activeSubscriptions, subscriptionsByPlan, storageAgg, topStorageUsers, queue,] = await Promise.all([
            models_1.User.countDocuments(),
            models_1.Project.countDocuments(),
            models_1.Subscription.countDocuments({ status: 'active', plan: { $in: ['pro', 'team'] } }),
            models_1.Subscription.aggregate([
                { $match: { status: 'active' } },
                { $group: { _id: '$plan', count: { $sum: 1 } } },
            ]),
            models_1.File.aggregate([{ $group: { _id: null, total: { $sum: '$size' } } }]),
            models_1.File.aggregate([
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
            queue_service_1.queueService.getStats(),
        ]);
        const planCounts = subscriptionsByPlan.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});
        const estimatedMonthlyRevenueCents = (planCounts.pro || 0) * paidPlanPricesCents.pro +
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getAdminStats = getAdminStats;
const listAdminUsers = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
        const search = String(req.query.search || '').trim();
        const role = String(req.query.role || '').trim();
        const status = String(req.query.status || '').trim();
        const plan = String(req.query.plan || '').trim();
        const filter = {};
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }
        if (['user', 'admin', 'superadmin'].includes(role))
            filter.role = role;
        if (['active', 'suspended', 'pending'].includes(status))
            filter.status = status;
        if (['free', 'pro', 'team', 'enterprise'].includes(plan))
            filter.plan = plan;
        const [users, total] = await Promise.all([
            models_1.User.find(filter, 'name email avatar plan role status isVerified createdAt updatedAt')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            models_1.User.countDocuments(filter),
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.listAdminUsers = listAdminUsers;
const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        if (!['user', 'admin', 'superadmin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role.' });
        }
        if (role === 'superadmin' && req.user?.role !== 'superadmin') {
            return res.status(403).json({ error: 'Only superadmins can assign superadmin role.' });
        }
        const target = await models_1.User.findById(id);
        if (!target)
            return res.status(404).json({ error: 'User not found.' });
        if (target.role === 'superadmin' && req.user?.role !== 'superadmin') {
            return res.status(403).json({ error: 'Only superadmins can edit superadmin accounts.' });
        }
        if (target._id.toString() === req.user?.id && role === 'user') {
            return res.status(400).json({ error: 'You cannot remove your own admin access.' });
        }
        target.role = role;
        await target.save();
        await notification_service_1.notificationService.create({
            userId: target._id,
            title: 'تم تحديث صلاحيات الحساب',
            message: `تم تغيير دور حسابك إلى ${role}.`,
            type: 'info',
            link: '/profile',
        });
        return res.status(200).json({ user: target });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.updateUserRole = updateUserRole;
const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['active', 'suspended', 'pending'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status.' });
        }
        const target = await models_1.User.findById(id);
        if (!target)
            return res.status(404).json({ error: 'User not found.' });
        if (target.role === 'superadmin' && req.user?.role !== 'superadmin') {
            return res.status(403).json({ error: 'Only superadmins can edit superadmin accounts.' });
        }
        if (target._id.toString() === req.user?.id && status === 'suspended') {
            return res.status(400).json({ error: 'You cannot suspend your own account.' });
        }
        target.status = status;
        await target.save();
        await notification_service_1.notificationService.create({
            userId: target._id,
            title: 'تم تحديث حالة الحساب',
            message: `تم تغيير حالة حسابك إلى ${status}.`,
            type: status === 'suspended' ? 'warning' : 'info',
            link: '/profile',
        });
        return res.status(200).json({ user: target });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.updateUserStatus = updateUserStatus;
const getUserActivity = async (req, res) => {
    try {
        const { id } = req.params;
        const activities = await models_1.Activity.find({ userId: id }).sort({ createdAt: -1 }).limit(100);
        return res.status(200).json({ activities });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getUserActivity = getUserActivity;
const listAdminProjects = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
        const search = String(req.query.search || '').trim();
        const filter = {};
        if (search)
            filter.name = { $regex: search, $options: 'i' };
        const [projects, total] = await Promise.all([
            models_1.Project.find(filter)
                .populate('userId', 'name email plan status')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            models_1.Project.countDocuments(filter),
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.listAdminProjects = listAdminProjects;
const forceDeleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid project id.' });
        }
        const project = await models_1.Project.findByIdAndDelete(id);
        if (!project)
            return res.status(404).json({ error: 'Project not found.' });
        await Promise.all([
            models_1.File.deleteMany({ projectId: id }),
            models_1.CodeEntity.deleteMany({ projectId: id }),
            models_1.Embedding.deleteMany({ projectId: id }),
            models_1.Activity.deleteMany({ entityId: id, entityType: 'project' }),
            storage_service_1.storageService.deleteProjectFiles(id),
        ]);
        await models_1.Activity.create({
            userId: req.user.id,
            action: 'admin_project_deleted',
            entityType: 'project',
            entityId: project._id,
            metadata: { projectName: project.name, ownerId: project.userId },
        });
        await notification_service_1.notificationService.create({
            userId: project.userId,
            title: 'تم حذف مشروع بواسطة الإدارة',
            message: `تم حذف مشروع ${project.name} بواسطة فريق الإدارة.`,
            type: 'warning',
            link: '/projects',
        });
        return res.status(200).json({ message: 'Project deleted by admin.' });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.forceDeleteProject = forceDeleteProject;
const updatePlanLimits = async (req, res) => {
    try {
        const { limits } = req.body;
        if (!limits || typeof limits !== 'object') {
            return res.status(400).json({ error: 'Limits object is required.' });
        }
        const setting = await models_1.AdminSetting.findOneAndUpdate({ key: 'plan_limits' }, { value: limits }, { upsert: true, new: true });
        await models_1.Activity.create({
            userId: req.user.id,
            action: 'admin_plan_limits_updated',
            entityType: 'auth',
            metadata: { limits },
        });
        return res.status(200).json({ setting });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.updatePlanLimits = updatePlanLimits;
