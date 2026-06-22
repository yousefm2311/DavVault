import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request type to include user information
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    plan: 'free' | 'pro' | 'team' | 'enterprise';
  };
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET || 'devvault_secret_access_token_key_2026';
    const decoded = jwt.verify(token, secret) as {
      id: string;
      email: string;
      plan: 'free' | 'pro' | 'team' | 'enterprise';
    };

    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(403).json({ error: 'Invalid token.' });
  }
};

export const requirePlan = (allowedPlans: ('free' | 'pro' | 'team' | 'enterprise')[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (!allowedPlans.includes(req.user.plan)) {
      return res.status(403).json({ error: `Requires one of the plans: ${allowedPlans.join(', ')}` });
    }

    next();
  };
};
