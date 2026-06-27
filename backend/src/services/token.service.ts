import { Response } from 'express';
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
export const REFRESH_COOKIE_NAME = 'devvault_refresh';

type TokenUser = {
  _id: unknown;
  email: string;
  plan: string;
  role?: string;
  tokenVersion?: number;
};

const requiredSecret = (name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string => {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(`${name} must be configured with at least 32 characters.`);
  }
  return value;
};

export const assertTokenSecrets = (): void => {
  requiredSecret('JWT_SECRET');
  requiredSecret('JWT_REFRESH_SECRET');
};

export const generateTokens = (user: TokenUser) => {
  const tokenVersion = user.tokenVersion || 0;
  const accessToken = jwt.sign(
    {
      id: user._id,
      email: user.email,
      plan: user.plan,
      role: user.role || 'user',
      tokenVersion,
    },
    requiredSecret('JWT_SECRET'),
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
  const refreshToken = jwt.sign(
    { id: user._id, tokenVersion },
    requiredSecret('JWT_REFRESH_SECRET'),
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
  return { accessToken, refreshToken };
};

export const setRefreshCookie = (res: Response, refreshToken: string): void => {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  });
};

export const readCookie = (cookieHeader: string | undefined, name: string): string | undefined => {
  if (!cookieHeader) return undefined;
  for (const entry of cookieHeader.split(';')) {
    const [key, ...valueParts] = entry.trim().split('=');
    if (key === name) return decodeURIComponent(valueParts.join('='));
  }
  return undefined;
};

export const verifyRefreshToken = (token: string): { id: string; tokenVersion: number } =>
  jwt.verify(token, requiredSecret('JWT_REFRESH_SECRET')) as {
    id: string;
    tokenVersion: number;
  };
