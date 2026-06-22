'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  avatar?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  workspaceId: string | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  register: (name: string, email: string, password: string) => Promise<any>;
  socialLogin: (name: string, email: string, provider: 'google' | 'github') => Promise<void>;
  logout: () => void;
  apiFetch: (endpoint: string, options?: RequestInit) => Promise<any>;
  verifyCode: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

  useEffect(() => {
    // Check if tokens exist in local storage on mount
    const checkAuth = async () => {
      const storedUser = localStorage.getItem('user');
      const storedWorkspace = localStorage.getItem('workspaceId');
      const storedAccess = localStorage.getItem('accessToken');
      const storedRefresh = localStorage.getItem('refreshToken');

      if (storedUser && storedAccess && storedRefresh) {
        setUser(JSON.parse(storedUser));
        setWorkspaceId(storedWorkspace);
        setAccessToken(storedAccess);

        // Try to refresh token immediately to verify validity
        try {
          await refreshTokens(storedRefresh);
        } catch (e) {
          // If refresh fails, log out
          clearAuth();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const clearAuth = () => {
    setUser(null);
    setWorkspaceId(null);
    setAccessToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('workspaceId');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  };

  const refreshTokens = async (refreshToken: string) => {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: refreshToken }),
    });

    if (!res.ok) throw new Error('Refresh failed');
    const data = await res.json();
    
    setAccessToken(data.accessToken);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
  };

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
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

    setUser(data.user);
    setWorkspaceId(data.workspaceId);
    setAccessToken(data.accessToken);

    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('workspaceId', data.workspaceId || '');
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);

    router.push('/dashboard');
    return data;
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Verification failed');

    setUser(data.user);
    setWorkspaceId(data.workspaceId);
    setAccessToken(data.accessToken);

    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('workspaceId', data.workspaceId || '');
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);

    router.push('/dashboard');
  };

  const resendCode = async (email: string) => {
    const res = await fetch(`${API_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to resend code');
    return data;
  };

  const socialLogin = async (name: string, email: string, provider: 'google' | 'github') => {
    const res = await fetch(`${API_URL}/auth/oauth/stub`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        provider,
        providerId: `oauth_${provider}_${Date.now()}`,
        avatar: provider === 'github' ? 'https://github.com/github.png' : 'https://lh3.googleusercontent.com/a/default-user',
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'OAuth Login failed');

    setUser(data.user);
    setWorkspaceId(data.workspaceId);
    setAccessToken(data.accessToken);

    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('workspaceId', data.workspaceId || '');
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);

    router.push('/dashboard');
  };

  const logout = () => {
    clearAuth();
    router.push('/login');
  };

  // Wrapper for authenticated fetch calls
  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    let token = accessToken;
    
    // Check if token exists
    if (!token) {
      const storedAccess = localStorage.getItem('accessToken');
      if (storedAccess) token = storedAccess;
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle token expiration and attempt auto-refresh
    if (res.status === 401) {
      const storedRefresh = localStorage.getItem('refreshToken');
      if (storedRefresh) {
        try {
          await refreshTokens(storedRefresh);
          const newToken = localStorage.getItem('accessToken');
          
          // Retry original request with new token
          const retryHeaders = {
            ...headers,
            'Authorization': `Bearer ${newToken}`,
          };
          const retryRes = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: retryHeaders,
          });
          return retryRes.json();
        } catch (e) {
          clearAuth();
          router.push('/login');
          throw new Error('Session expired');
        }
      }
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
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
        logout,
        apiFetch,
        verifyCode,
        resendCode,
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
