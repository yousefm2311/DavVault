import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { Subscription, Project, Activity, File as DBFile } from '../models';
import mongoose from 'mongoose';

export const getSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const userId = req.user.id;

    // Find or create default subscription
    let subscription = await Subscription.findOne({ userId });
    if (!subscription) {
      subscription = await Subscription.create({
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
    const projectsCount = await Project.countDocuments({ userId });

    // Sum file sizes in MongoDB for this user
    const filesSize = await DBFile.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, totalSize: { $sum: '$size' } } }
    ]);
    const storageBytes = filesSize[0]?.totalSize || 0;

    // Count AI queries this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const aiQuestionsUsed = await Activity.countDocuments({
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const upgradeSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
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
    } else if (plan === 'team') {
      limits = {
        projectsCount: 100,
        storageBytes: 20 * 1024 * 1024 * 1024, // 20GB
        aiQuestionsPerMonth: 1500
      };
    }

    const subscription = await Subscription.findOneAndUpdate(
      { userId },
      {
        plan,
        limits,
        status: 'active',
        renewAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days renewal simulation
      },
      { new: true, upsert: true }
    );

    // Update User model plan field
    await mongoose.model('User').findByIdAndUpdate(userId, { plan });

    return res.status(200).json({
      message: `Successfully updated subscription to ${plan.toUpperCase()}`,
      subscription
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
