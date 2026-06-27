'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

function OAuthCallbackContent() {
  const router = useRouter();
  const { completeOAuthLogin } = useAuth();
  const { t, dir } = useLanguage();

  useEffect(() => {
    void completeOAuthLogin().catch(() => {
      setTimeout(() => router.push('/login?oauth_error=callback_failed'), 1200);
    });
  }, [completeOAuthLogin, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-6 text-white" dir={dir}>
      <div className="rounded-[28px] border border-card-border bg-card-bg/60 p-8 text-center glass">
        <h1 className="text-lg font-bold">{t('oauthCompleting')}</h1>
        <p className="mt-2 text-xs text-text-secondary">
          {t('oauthSavingSession')}
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
