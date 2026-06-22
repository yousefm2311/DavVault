"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upgradeSubscription = exports.getSubscription = void 0;
const models_1 = require("../models");
const mongoose_1 = __importDefault(require("mongoose"));
const getSubscription = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const userId = req.user.id;
        // Find or create default subscription
        let subscription = await models_1.Subscription.findOne({ userId });
        if (!subscription) {
            subscription = await models_1.Subscription.create({
                userId,
                plan: 'free',
                status: 'active',
                limits: {
                    projectsCount: 2,
                    storageBytes: 100 * 1024 * 1024,
                    aiQuestionsPerMonth: 20,
                },
            });
        }
        // Query active counts
        const projectsCount = await models_1.Project.countDocuments({ userId });
        // Sum file sizes in MongoDB for this user
        const filesSize = await models_1.File.aggregate([
            { $match: { userId: new mongoose_1.default.Types.ObjectId(userId) } },
            { $group: { _id: null, totalSize: { $sum: '$size' } } }
        ]);
        const storageBytes = filesSize[0]?.totalSize || 0;
        // Count AI queries this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const aiQuestionsUsed = await models_1.Activity.countDocuments({
            userId,
            action: 'ai_question',
            createdAt: { $gte: startOfMonth }
        });
        return res.status(200).json({
            plan: subscription.plan,
            status: subscription.status,
            limits: subscription.limits,
            usage: {
                projectsCount,
                storageBytes,
                aiQuestionsUsed
            }
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getSubscription = getSubscription;
const upgradeSubscription = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const userId = req.user.id;
        const { plan } = req.body;
        if (!['free', 'pro', 'team'].includes(plan)) {
            return res.status(400).json({ error: 'Invalid plan selected. Choose: free, pro, or team.' });
        }
        // Configure limits based on plan
        let limits = {
            projectsCount: 2,
            storageBytes: 100 * 1024 * 1024, // 100MB
            aiQuestionsPerMonth: 20
        };
        if (plan === 'pro') {
            limits = {
                projectsCount: 15,
                storageBytes: 2 * 1024 * 1024 * 1024, // 2GB
                aiQuestionsPerMonth: 250
            };
        }
        else if (plan === 'team') {
            limits = {
                projectsCount: 100,
                storageBytes: 20 * 1024 * 1024 * 1024, // 20GB
                aiQuestionsPerMonth: 1500
            };
        }
        const subscription = await models_1.Subscription.findOneAndUpdate({ userId }, {
            plan,
            limits,
            status: 'active',
            renewAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days renewal simulation
        }, { new: true, upsert: true });
        // Update User model plan field
        await mongoose_1.default.model('User').findByIdAndUpdate(userId, { plan });
        return res.status(200).json({
            message: `Successfully updated subscription to ${plan.toUpperCase()}`,
            subscription
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.upgradeSubscription = upgradeSubscription;
