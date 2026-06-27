import { Request, Response, NextFunction } from 'express';

export const validateBody = (requiredFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const missingFields = requiredFields.filter((field) => {
      const val = req.body[field];
      return val === undefined || val === null || val === '';
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missingFields.join(', ')}`,
      });
    }

    next();
  };
};

export const validateEmail = (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body;
  if (!email) return next();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address format.' });
  }

  next();
};

export const validatePassword = (req: Request, res: Response, next: NextFunction) => {
  const password = req.body.password || req.body.newPassword;
  if (!password) return next();

  if (
    typeof password !== 'string' ||
    password.length < 10 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return res.status(400).json({
      error: 'Password must be at least 10 characters and include uppercase, lowercase, number, and symbol.',
    });
  }

  next();
};
