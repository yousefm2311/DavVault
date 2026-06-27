'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  role?: 'user' | 'admin' | 'superadmin';
  status?: 'active' | 'suspended' | 'pending';
  avatar?: string;
  bio?: string;
  createdAt?: string;
}

type AuthPayload = {
  user: unknown;
  workspaceId?: string | null;
  accessToken?: string;
  tokens?: {
    accessToken?: string;
  };
};

interface AuthContextType {
  user: UserProfile | null;
  workspaceId: string | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  register: (name: string, email: string, password: string) => Promise<any>;
  socialLogin: (name: string, email: string, provider: 'google' | 'github') => Promise<void>;
  completeOAuthLogin: () => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: (endpoint: string, options?: RequestInit) => Promise<any>;
  verifyCode: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<any>;
  updateUserState: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

  const normalizeUser = (rawUser: any): UserProfile => {
    if (!rawUser) {
      throw new Error('Invalid user session payload');
    }

    const rawId = rawUser.id || rawUser._id;
    if (!rawId) {
      throw new Error('Invalid user session id');
    }

    return {
      id: String(rawId),
      name: rawUser.name || rawUser.email?.split('@')[0] || 'DevVault User',
      email: rawUser.email || '',
      plan: rawUser.plan || 'free',
      role: rawUser.role || 'user',
      status: rawUser.status || 'active',
      avatar: rawUser.avatar,
      bio: rawUser.bio,
      createdAt: rawUser.createdAt,
    };
  };

  const parseApiResponse = async (res: Response) => {
    const text = await res.text();
    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch {
      return { error: text };
    }
  };

  const clearAuth = () => {
    setUser(null);
    setWorkspaceId(null);
    setAccessToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('workspaceId');
  };

  const persistSession = (payload: AuthPayload) => {
    const sessionUser = normalizeUser(payload.user);
    const sessionAccessToken = payload.accessToken || payload.tokens?.accessToken;

    if (!sessionAccessToken) {
      throw new Error('Incomplete authentication payload');
    }

    const sessionWorkspaceId = payload.workspaceId || null;

    setUser(sessionUser);
    setWorkspaceId(sessionWorkspaceId);
    setAccessToken(sessionAccessToken);

    localStorage.setItem('user', JSON.stringify(sessionUser));
    localStorage.setItem('workspaceId', sessionWorkspaceId || '');
    return sessionUser;
  };

  const redirectToLogin = (reason = 'session_expired') => {
    clearAuth();
    router.push(`/login?reason=${encodeURIComponent(reason)}`);
  };

  const raiseApiError = (data: any, status: number, fallback: string) => {
    const error = new Error(data?.error || fallback) as Error & { status?: number };
    error.status = status;
    return error;
  };

  const refreshTokens = async () => {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await parseApiResponse(res);
    if (!res.ok) throw raiseApiError(data, res.status, 'Refresh failed');

    const nextAccessToken = data.accessToken;
    if (!nextAccessToken) {
      throw new Error('Refresh response is missing tokens');
    }

    if (data.user) {
      const sessionUser = normalizeUser(data.user);
      setUser(sessionUser);
      localStorage.setItem('user', JSON.stringify(sessionUser));
    }

    if (data.workspaceId !== undefined) {
      setWorkspaceId(data.workspaceId || null);
      localStorage.setItem('workspaceId', data.workspaceId || '');
    }

    setAccessToken(nextAccessToken);
    return { accessToken: nextAccessToken };
  };

  const fetchProfile = async (token: string) => {
    const res = await fetch(`${API_URL}/user/profile`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await parseApiResponse(res);
    if (!res.ok) throw raiseApiError(data, res.status, 'Profile validation failed');
    return data;
  };

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      const storedWorkspace = localStorage.getItem('workspaceId');
      try {
        const refreshed = await refreshTokens();
        const validAccessToken = refreshed.accessToken;
        const profilePayload = await fetchProfile(validAccessToken);

        if (cancelled) return;

        const sessionUser = normalizeUser(profilePayload.user);
        const sessionWorkspaceId =
          profilePayload.workspaceId !== undefined ? profilePayload.workspaceId : storedWorkspace;

        setUser(sessionUser);
        setWorkspaceId(sessionWorkspaceId || null);
        setAccessToken(validAccessToken);

        localStorage.setItem('user', JSON.stringify(sessionUser));
        localStorage.setItem('workspaceId', sessionWorkspaceId || '');
      } catch (e) {
        if (!cancelled) {
          clearAuth();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403 && data.requiresVerification) {
        return data; // Return to handle verification transition
      }
      throw new Error(data.error || 'Login failed');
    }

    persistSession(data);

    router.push('/dashboard');
    return data;
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');

    return data;
  };

  const verifyCode = async (email: string, code: string) => {
    const res = await fetch(`${API_URL}/auth/verify`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Verification failed');

    persistSession(data);

    router.push('/dashboard');
  };

  const resendCode = async (email: string) => {
    const res = await fetch(`${API_URL}/auth/resend-verification`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to resend code');
    return data;
  };

  const socialLogin = async (name: string, email: string, provider: 'google' | 'github') => {
    window.location.href = `${API_URL}/auth/oauth/${provider}/start`;
  };

  const completeOAuthLogin = async () => {
    const data = await refreshTokens();
    const profile = await fetchProfile(data.accessToken);
    persistSession({ ...profile, accessToken: data.accessToken });
    router.push('/dashboard');
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      clearAuth();
    }
    router.push('/login');
  };

  // Wrapper for authenticated fetch calls
  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    let token = accessToken;
    
    // Check if token exists
    if (!token) {
      token = accessToken;
    }

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers: HeadersInit = {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers,
    });

    // Handle token expiration and attempt auto-refresh
    if (res.status === 401) {
      let refreshed: { accessToken: string };
      try {
        refreshed = await refreshTokens();
      } catch (e: any) {
        const reason = String(e?.message || '').toLowerCase().includes('suspended')
          ? 'account_suspended'
          : 'session_expired';
        redirectToLogin(reason);
        throw new Error('Session expired');
      }

      const retryHeaders = {
        ...headers,
        'Authorization': `Bearer ${refreshed.accessToken}`,
      };
      const retryRes = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: retryHeaders,
      });
      const retryData = await parseApiResponse(retryRes);
      if (retryRes.status === 401) {
        redirectToLogin('session_expired');
        throw new Error('Session expired');
      }
      if (retryRes.status === 403 && String(retryData.error || '').toLowerCase().includes('suspended')) {
        redirectToLogin('account_suspended');
        throw new Error('Account suspended');
      }
      if (!retryRes.ok) throw new Error(retryData.error || 'Request failed');
      return retryData;
    }

    const data = await parseApiResponse(res);
    if (res.status === 403 && String(data.error || '').toLowerCase().includes('suspended')) {
      redirectToLogin('account_suspended');
      throw new Error('Account suspended');
    }
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const updateUserState = (updatedUser: UserProfile) => {
    const sessionUser = normalizeUser(updatedUser);
    setUser(sessionUser);
    localStorage.setItem('user', JSON.stringify(sessionUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspaceId,
        accessToken,
        loading,
        login,
        register,
        socialLogin,
        completeOAuthLogin,
        logout,
        apiFetch,
        verifyCode,
        resendCode,
        updateUserState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
