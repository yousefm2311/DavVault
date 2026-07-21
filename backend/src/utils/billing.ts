import mongoose from 'mongoose';
import { Activity, File as DBFile, Project, Subscription, User, Workspace } from '../models';

export type BillablePlan = 'free' | 'pro' | 'team' | 'enterprise';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';

export const planLimits: Record<BillablePlan, {
  projectsCount: number;
  storageBytes: number;
  aiQuestionsPerMonth: number;
  teamMembers: number;
}> = {
  free: {
    projectsCount: 2,
    storageBytes: 100 * 1024 * 1024,
    aiQuestionsPerMonth: 20,
    teamMembers: 1,
  },
  pro: {
    projectsCount: 15,
    storageBytes: 2 * 1024 * 1024 * 1024,
    aiQuestionsPerMonth: 250,
    teamMembers: 3,
  },
  team: {
    projectsCount: 100,
    storageBytes: 20 * 1024 * 1024 * 1024,
    aiQuestionsPerMonth: 1500,
    teamMembers: 25,
  },
  enterprise: {
    projectsCount: 1000,
    storageBytes: 200 * 1024 * 1024 * 1024,
    aiQuestionsPerMonth: 10000,
    teamMembers: 250,
  },
};

export const isValidMongoId = (value: unknown): value is string => (
  typeof value === 'string' &&
  /^[a-fA-F0-9]{24}$/.test(value) &&
  mongoose.Types.ObjectId.isValid(value)
);

export const isBillablePlan = (value: unknown): value is BillablePlan => (
  typeof value === 'string' && ['free', 'pro', 'team', 'enterprise'].includes(value)
);

export const isCheckoutPlan = (value: unknown): value is 'pro' | 'team' => (
  value === 'pro' || value === 'team'
);

export const stripeConfigured = () => Boolean(
  process.env.STRIPE_SECRET_KEY &&
  process.env.STRIPE_PRO_PRICE_ID &&
  process.env.STRIPE_TEAM_PRICE_ID
);

export const mapStripeStatus = (status?: string): SubscriptionStatus => {
  if (status === 'active') return 'active';
  if (status === 'trialing') return 'trialing';
  if (status === 'past_due' || status === 'unpaid') return 'past_due';
  if (status === 'incomplete' || status === 'incomplete_expired') return 'incomplete';
  return 'canceled';
};

export const effectivePlanForStatus = (
  plan: BillablePlan,
  status: SubscriptionStatus
): BillablePlan => (
  status === 'active' || status === 'trialing' ? plan : 'free'
);

export const ensureSubscription = async (userId: string) => {
  let subscription = await Subscription.findOne({ userId });
  if (!subscription) {
    subscription = await Subscription.create({
      userId,
      plan: 'free',
      status: 'active',
      limits: planLimits.free,
      isLocalSimulation: !stripeConfigured(),
      renewAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    await User.findByIdAndUpdate(userId, { plan: 'free' });
  }
  return subscription;
};

export const getUsageSnapshot = async (userId: string) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [projectsCount, filesSize, aiQuestionsUsed, workspace] = await Promise.all([
    Project.countDocuments({ userId }),
    DBFile.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, totalSize: { $sum: '$size' } } },
    ]),
    Activity.countDocuments({
      userId,
      action: 'ai_question',
      createdAt: { $gte: startOfMonth },
    }),
    Workspace.findOne({ ownerId: userId }, 'members').lean(),
  ]);

  return {
    projectsCount,
    storageBytes: filesSize[0]?.totalSize || 0,
    aiQuestionsUsed,
    teamMembers: Array.isArray((workspace as any)?.members) ? (workspace as any).members.length : 1,
  };
};

export const buildSubscriptionPayload = async (userId: string) => {
  const subscription = await ensureSubscription(userId);
  const status = mapStripeStatus(subscription.status);
  const storedPlan = isBillablePlan(subscription.plan) ? subscription.plan : 'free';
  const effectivePlan = effectivePlanForStatus(storedPlan, status);
  const limits = planLimits[effectivePlan] || planLimits.free;
  const usage = await getUsageSnapshot(userId);
  const resetAt = subscription.renewAt || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

  return {
    plan: effectivePlan,
    status,
    limits,
    usage,
    remaining: {
      projectsCount: Math.max(0, limits.projectsCount - usage.projectsCount),
      storageBytes: Math.max(0, limits.storageBytes - usage.storageBytes),
      aiQuestions: Math.max(0, limits.aiQuestionsPerMonth - usage.aiQuestionsUsed),
      teamMembers: Math.max(0, limits.teamMembers - usage.teamMembers),
    },
    resetAt: resetAt.toISOString(),
    isLocalSimulation: Boolean(subscription.isLocalSimulation || !stripeConfigured()),
    stripeConfigured: stripeConfigured(),
  };
};
