"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = exports.createCheckoutSession = exports.upgradeSubscription = exports.getSubscription = void 0;
const models_1 = require("../models");
const mongoose_1 = __importDefault(require("mongoose"));
const crypto_1 = __importDefault(require("crypto"));
const notification_service_1 = require("../services/notification.service");
const planLimits = {
    free: {
        projectsCount: 2,
        storageBytes: 100 * 1024 * 1024,
        aiQuestionsPerMonth: 20,
    },
    pro: {
        projectsCount: 15,
        storageBytes: 2 * 1024 * 1024 * 1024,
        aiQuestionsPerMonth: 250,
    },
    team: {
        projectsCount: 100,
        storageBytes: 20 * 1024 * 1024 * 1024,
        aiQuestionsPerMonth: 1500,
    },
};
const getStripePriceId = (plan) => {
    if (plan === 'pro')
        return process.env.STRIPE_PRO_PRICE_ID;
    return process.env.STRIPE_TEAM_PRICE_ID;
};
const syncSubscriptionPlan = async ({ userId, plan, stripeCustomerId, stripeSubscriptionId, status = 'active', }) => {
    const subscription = await models_1.Subscription.findOneAndUpdate({ userId }, {
        plan,
        limits: planLimits[plan],
        status,
        renewAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ...(stripeCustomerId ? { stripeCustomerId } : {}),
        ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
    }, { new: true, upsert: true });
    await models_1.User.findByIdAndUpdate(userId, { plan });
    await notification_service_1.notificationService.create({
        userId,
        title: 'تم تحديث الاشتراك',
        message: `تم تفعيل خطة ${plan.toUpperCase()} وتحديث حدود الاستخدام الخاصة بحسابك.`,
        type: plan === 'free' ? 'info' : 'success',
        link: '/billing',
    });
    return subscription;
};
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
        const subscription = await syncSubscriptionPlan({ userId, plan });
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
const createCheckoutSession = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const { plan } = req.body;
        if (!['pro', 'team'].includes(plan)) {
            return res.status(400).json({ error: 'Stripe checkout supports pro or team plans.' });
        }
        const stripeSecret = process.env.STRIPE_SECRET_KEY;
        const priceId = getStripePriceId(plan);
        if (!stripeSecret || !priceId) {
            return res.status(501).json({
                error: 'Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_*_PRICE_ID to enable real billing.',
                stripeConfigured: false,
            });
        }
        const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing?checkout=success`;
        const cancelUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing?checkout=cancelled`;
        const body = new URLSearchParams({
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            client_reference_id: req.user.id,
            'line_items[0][price]': priceId,
            'line_items[0][quantity]': '1',
            'metadata[userId]': req.user.id,
            'metadata[plan]': plan,
            'subscription_data[metadata][userId]': req.user.id,
            'subscription_data[metadata][plan]': plan,
        });
        const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${stripeSecret}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
        });
        const data = await response.json();
        if (!response.ok) {
            return res.status(502).json({ error: data.error?.message || 'Stripe checkout session failed.' });
        }
        return res.status(200).json({ checkoutUrl: data.url, sessionId: data.id });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.createCheckoutSession = createCheckoutSession;
const stripeWebhook = async (req, res) => {
    try {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        const signature = req.header('stripe-signature');
        if (!webhookSecret || !signature) {
            return res.status(400).json({ error: 'Stripe webhook secret/signature missing.' });
        }
        const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
        const timestamp = signature.split(',').find((part) => part.startsWith('t='))?.slice(2);
        const provided = signature.split(',').find((part) => part.startsWith('v1='))?.slice(3);
        if (!timestamp || !provided)
            return res.status(400).json({ error: 'Invalid Stripe signature.' });
        const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
        const expected = crypto_1.default.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
        if (Buffer.byteLength(expected) !== Buffer.byteLength(provided) ||
            !crypto_1.default.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) {
            return res.status(400).json({ error: 'Stripe signature verification failed.' });
        }
        const event = JSON.parse(rawBody.toString('utf8'));
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const userId = session.metadata?.userId || session.client_reference_id;
            const plan = session.metadata?.plan;
            if (userId && ['pro', 'team'].includes(plan)) {
                await syncSubscriptionPlan({
                    userId,
                    plan,
                    stripeCustomerId: session.customer,
                    stripeSubscriptionId: session.subscription,
                });
            }
        }
        if (event.type === 'customer.subscription.deleted') {
            const subscriptionId = event.data.object.id;
            const subscription = await models_1.Subscription.findOne({ stripeSubscriptionId: subscriptionId });
            if (subscription) {
                await syncSubscriptionPlan({
                    userId: subscription.userId.toString(),
                    plan: 'free',
                    status: 'canceled',
                });
            }
        }
        return res.status(200).json({ received: true });
    }
    catch (error) {
        console.error('[Stripe Webhook]: Failed:', error);
        return res.status(400).json({ error: error.message });
    }
};
exports.stripeWebhook = stripeWebhook;
