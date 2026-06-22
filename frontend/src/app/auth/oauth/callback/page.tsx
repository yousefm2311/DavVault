'use client';

import React, { Suspense, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

function OAuthCallbackContent() {
  const router = useRouter();
  const { completeOAuthLogin } = useAuth();
  const { t, dir } = useLanguage();

  const error = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return hash.get('payload') ? null : t('oauthNoPayload');
  }, [t]);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const payload = hash.get('payload');
    if (!payload) {
      setTimeout(() => router.push('/login?oauth_error=callback_failed'), 1200);
      return;
    }

    try {
      completeOAuthLogin(payload);
    } catch {
      setTimeout(() => router.push('/login?oauth_error=callback_failed'), 1200);
    }
  }, [completeOAuthLogin, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-6 text-white" dir={dir}>
      <div className="rounded-[28px] border border-card-border bg-card-bg/60 p-8 text-center glass">
        <h1 className="text-lg font-bold">{error ? t('oauthLoginFailed') : t('oauthCompleting')}</h1>
        <p className="mt-2 text-xs text-text-secondary">
          {error || t('oauthSavingSession')}
        </p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-primary" />}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
