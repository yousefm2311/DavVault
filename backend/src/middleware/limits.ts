import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { buildSubscriptionPayload, isValidMongoId } from '../utils/billing';

const limitExceededResponse = (
  res: Response,
  resource: 'project' | 'aiQuestions',
  payload: Awaited<ReturnType<typeof buildSubscriptionPayload>>
) => {
  const limit = resource === 'project'
    ? payload.limits.projectsCount
    : payload.limits.aiQuestionsPerMonth;
  const current = resource === 'project'
    ? payload.usage.projectsCount
    : payload.usage.aiQuestionsUsed;
  const remaining = resource === 'project'
    ? payload.remaining.projectsCount
    : payload.remaining.aiQuestions;

  return res.status(403).json({
    error: resource === 'project'
      ? `Your subscription plan (${payload.plan.toUpperCase()}) only allows a maximum of ${limit} projects. Please upgrade your plan.`
      : `Your subscription plan (${payload.plan.toUpperCase()}) only allows a maximum of ${limit} AI questions per month. Please upgrade your plan.`,
    code: 'LIMIT_EXCEEDED',
    resource,
    plan: payload.plan,
    status: payload.status,
    limit,
    current,
    remaining,
    resetAt: payload.resetAt,
    isLocalSimulation: payload.isLocalSimulation,
  });
};

export const checkPlanLimits = (resourceType: 'project' | 'aiQuestions') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }

      const userId = req.user.id;
      if (!isValidMongoId(userId)) {
        return res.status(400).json({
          error: 'Invalid user id.',
          code: 'INVALID_OBJECT_ID',
        });
      }

      const payload = await buildSubscriptionPayload(userId);

      if (resourceType === 'project') {
        if (payload.usage.projectsCount >= payload.limits.projectsCount) {
          return limitExceededResponse(res, 'project', payload);
        }
      } else if (resourceType === 'aiQuestions') {
        if (payload.usage.aiQuestionsUsed >= payload.limits.aiQuestionsPerMonth) {
          return limitExceededResponse(res, 'aiQuestions', payload);
        }
      }

      return next();
    } catch {
      return res.status(500).json({
        error: 'Unable to verify plan limits.',
        code: 'PLAN_LIMIT_CHECK_FAILED',
      });
    }
  };
};
