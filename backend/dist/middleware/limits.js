"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPlanLimits = void 0;
const models_1 = require("../models");
const checkPlanLimits = (resourceType) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized.' });
            }
            const userId = req.user.id;
            // 1. Fetch user's subscription
            let subscription = await models_1.Subscription.findOne({ userId });
            if (!subscription) {
                // Fallback to default free tier if subscription record is missing
                subscription = await models_1.Subscription.create({
                    userId,
                    plan: 'free',
                    status: 'active',
                    limits: {
                        projectsCount: 2,
                        storageBytes: 100 * 1024 * 1024,
                        aiQuestionsPerMonth: 20
                    }
                });
            }
            if (subscription.status !== 'active') {
                return res.status(403).json({
                    error: 'Your subscription is inactive or has payment issues. Please update billing.',
                    code: 'BILLING_INACTIVE'
                });
            }
            // 2. Perform limit checks
            if (resourceType === 'project') {
                const projectsCount = await models_1.Project.countDocuments({ userId });
                if (projectsCount >= subscription.limits.projectsCount) {
                    return res.status(403).json({
                        error: `Your subscription plan (${subscription.plan.toUpperCase()}) only allows a maximum of ${subscription.limits.projectsCount} projects. Please upgrade your plan.`,
                        code: 'LIMIT_EXCEEDED',
                        resource: 'project',
                        limit: subscription.limits.projectsCount,
                        current: projectsCount
                    });
                }
            }
            else if (resourceType === 'aiQuestions') {
                // Count AI query activities in the current calendar month
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);
                const aiQueriesCount = await models_1.Activity.countDocuments({
                    userId,
                    action: 'ai_question',
                    createdAt: { $gte: startOfMonth }
                });
                if (aiQueriesCount >= subscription.limits.aiQuestionsPerMonth) {
                    return res.status(403).json({
                        error: `Your subscription plan (${subscription.plan.toUpperCase()}) only allows a maximum of ${subscription.limits.aiQuestionsPerMonth} AI questions per month. Please upgrade your plan.`,
                        code: 'LIMIT_EXCEEDED',
                        resource: 'aiQuestions',
                        limit: subscription.limits.aiQuestionsPerMonth,
                        current: aiQueriesCount
                    });
                }
            }
            return next();
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    };
};
exports.checkPlanLimits = checkPlanLimits;
