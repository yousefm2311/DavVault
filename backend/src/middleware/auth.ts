import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';

// Extend Express Request type to include user information
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    plan: 'free' | 'pro' | 'team' | 'enterprise';
    role: 'user' | 'admin' | 'superadmin';
    status: 'active' | 'suspended' | 'pending';
  };
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
      role?: 'user' | 'admin' | 'superadmin';
    };

    const user = await User.findById(decoded.id, 'email plan role status');
    if (!user) {
      return res.status(401).json({ error: 'Invalid token user.' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact support.' });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      plan: user.plan,
      role: user.role || 'user',
      status: user.status || 'active',
    };
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(403).json({ error: 'Invalid token.' });
  }
};

export const isAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  next();
};

export const isSuperAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Access denied. Super administrator privileges required.' });
  }
  next();
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
