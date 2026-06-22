'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { User, Mail, Lock, Zap } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const { user, loading: authLoading, register, socialLogin, verifyCode, resendCode } = useAuth();
  const { t, dir } = useLanguage();
  const isRtl = dir === 'rtl';

  // Registration states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Verification states
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [devCode, setDevCode] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationResending, setVerificationResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard');
    }
  }, [authLoading, router, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      setError(t('loginFieldsRequired'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await register(name, email, password);
      if (data.requiresVerification) {
        setRequiresVerification(true);
        if (data.devCode) {
          setDevCode(data.devCode);
        }
      }
    } catch (err: any) {
      setError(err.message || t('signupFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) return;
    setError(null);
    setVerificationLoading(true);
    try {
      await verifyCode(email, verificationCode);
    } catch (err: any) {
      setError(err.message || t('errorVerification'));
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setResendMessage(null);
    setVerificationResending(true);
    try {
      const data = await resendCode(email);
      setResendMessage(t('codeResentSuccess'));
      if (data.devCode) {
        setDevCode(data.devCode);
      }
    } catch (err: any) {
      setError(err.message || t('errorVerification'));
    } finally {
      setVerificationResending(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    setLoading(true);
    setError(null);
    try {
      const mockName = provider === 'google' ? t('googleDev') : t('githubDev');
      const mockEmail = `${provider}_dev_${Math.floor(Math.random() * 1000)}@devvault.ai`;
      await socialLogin(mockName, mockEmail, provider);
    } catch (err: any) {
      setError(err.message || t('errorOAuth'));
    } finally {
      setLoading(false);
    }
  };

  // Render Verification Panel
  if (requiresVerification) {
    return (
      <div className="flex min-h-screen bg-bg-primary text-white select-none items-center justify-center p-6 relative overflow-hidden" dir={dir}>
        {/* Dynamic ambient background blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-accent-blue/5 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-success/5 blur-[120px] pointer-events-none"></div>

        <div className="w-full max-w-[420px] bg-card-bg/60 border border-card-border rounded-[28px] p-8 shadow-2xl glass hover-scale relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-accent-blue flex items-center justify-center mb-3 shadow-lg shadow-accent-blue/20">
              <Zap className="w-6 h-6 text-white animate-pulse" />
            </div>
            <h2 className="font-bold text-2xl tracking-tight">{t('confirmEmail')}</h2>
            <p className="text-xs text-text-secondary mt-2 text-center px-4">
              {t('codeSentMsg')} <span className="text-white font-medium">{email}</span>
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-danger/10 border border-danger/25 text-danger rounded-2xl text-xs font-medium">
              {error}
            </div>
          )}

          {resendMessage && (
            <div className="mb-5 p-3.5 bg-success/10 border border-success/25 text-success rounded-2xl text-xs font-medium">
              {resendMessage}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-5">
            <div>
              <input
                type="text"
                placeholder={t('enterCodePlaceholder')}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={verificationLoading}
                className={`w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3.5 px-4 text-center text-lg font-bold text-white placeholder-text-secondary outline-none focus:border-accent-blue/50 transition-all ${verificationCode ? 'tracking-[0.45em]' : 'tracking-normal'}`}
                required
              />
            </div>

            {devCode && (
              <div className="p-3 bg-white/5 border border-card-border rounded-2xl text-[10px] text-center font-mono">
                {t('devCodeLabel')}: <span className="text-accent-blue font-bold">{devCode}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={verificationLoading || verificationCode.length < 6}
              className="w-full py-3.5 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-accent-blue/40 disabled:text-white/40 text-white rounded-2xl text-sm font-semibold transition-colors duration-200 cursor-pointer flex justify-center items-center"
            >
              {verificationLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                t('confirmAndLoginBtn')
              )}
            </button>
          </form>

          <div className="flex justify-between mt-6 text-xs px-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={verificationResending || verificationLoading}
              className="text-text-secondary hover:text-white transition-colors cursor-pointer disabled:text-text-secondary/40 font-medium"
            >
              {verificationResending ? t('resendingCode') : t('resendCodeBtn')}
            </button>
            <button
              type="button"
              onClick={() => {
                setRequiresVerification(false);
                setError(null);
                setResendMessage(null);
              }}
              disabled={verificationLoading}
              className="text-text-secondary hover:text-white transition-colors cursor-pointer font-medium"
            >
              {t('backToLogin')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render standard Register form
  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none items-center justify-center p-6 relative overflow-hidden" dir={dir}>
      {/* Dynamic background ambient lights */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-accent-blue/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-success/5 blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-[420px] bg-card-bg/60 border border-card-border rounded-[28px] p-8 shadow-2xl glass hover-scale relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent-blue flex items-center justify-center mb-3 shadow-lg shadow-accent-blue/20">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h2 className="font-bold text-2xl tracking-tight">{t('createAccount')}</h2>
          <p className="text-xs text-text-secondary mt-1">
            {t('enterMemory')}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-danger/10 border border-danger/25 text-danger rounded-2xl text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-3.5 w-4 h-4 text-text-secondary`} />
            <input
              type="text"
              placeholder={t('nameLabel')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className={`w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'} text-sm text-white placeholder-text-secondary outline-none focus:border-accent-blue/50 transition-colors`}
              required
            />
          </div>

          <div className="relative">
            <Mail className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-3.5 w-4 h-4 text-text-secondary`} />
            <input
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className={`w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'} text-sm text-white placeholder-text-secondary outline-none focus:border-accent-blue/50 transition-colors`}
              required
            />
          </div>

          <div className="relative">
            <Lock className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-3.5 w-4 h-4 text-text-secondary`} />
            <input
              type="password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className={`w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'} text-sm text-white placeholder-text-secondary outline-none focus:border-accent-blue/50 transition-colors`}
              required
            />
          </div>

          <div className="relative">
            <Lock className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-3.5 w-4 h-4 text-text-secondary`} />
            <input
              type="password"
              placeholder={t('confirmPassword')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              className={`w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'} text-sm text-white placeholder-text-secondary outline-none focus:border-accent-blue/50 transition-colors`}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-accent-blue/50 text-white rounded-2xl text-sm font-semibold transition-colors duration-200 cursor-pointer flex justify-center items-center"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              t('registerNow')
            )}
          </button>
        </form>

        <div className="relative flex py-5 items-center">
          <div className="flex-grow border-t border-card-border"></div>
          <span className="flex-shrink mx-4 text-[10px] text-text-secondary uppercase tracking-wider">
            {t('orContinueWith')}
          </span>
          <div className="flex-grow border-t border-card-border"></div>
        </div>

        {/* Social Authentication buttons */}
        <div className="grid grid-cols-2 gap-3.5">
          <button
            type="button"
            onClick={() => handleSocialLogin('google')}
            disabled={loading}
            className="flex items-center justify-center py-2.5 bg-bg-primary/45 border border-card-border rounded-2xl text-xs font-medium hover:bg-white/5 transition-all duration-200 cursor-pointer"
          >
            <svg className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-6.887 4.114-4.646 0-8.423-3.72-8.423-8.4s3.777-8.4 8.423-8.4c2.037 0 3.868.73 5.3 1.94l3.158-3.158C18.172 1.8 15.42 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.552 10.793-10.972 0-.74-.08-1.424-.223-2.223H12.24z"/>
            </svg>
            Google
          </button>
          <button
            type="button"
            onClick={() => handleSocialLogin('github')}
            disabled={loading}
            className="flex items-center justify-center py-2.5 bg-bg-primary/45 border border-card-border rounded-2xl text-xs font-medium hover:bg-white/5 transition-all duration-200 cursor-pointer"
          >
            <svg className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/>
            </svg>
            GitHub
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-text-secondary">
          {t('haveAccount')}{' '}
          <Link href="/login">
            <span className="text-accent-blue font-semibold hover:underline">{t('loginTitle')}</span>
          </Link>
        </p>
      </div>
    </div>
  );
}
