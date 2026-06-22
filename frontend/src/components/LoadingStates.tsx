'use client';

import React from 'react';
import { Sidebar } from '@/components/Sidebar';

export const SectionSkeleton: React.FC<{ rows?: number; className?: string }> = ({
  rows = 3,
  className = '',
}) => (
  <div className={`bg-card-bg/30 border border-card-border rounded-[28px] p-6 ${className}`}>
    <div className="skeleton h-5 w-40 rounded-xl mb-5" />
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 rounded-2xl bg-white/[0.03] p-4">
          <div className="skeleton h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-3 w-2/5 rounded-full" />
            <div className="skeleton h-3 w-4/5 rounded-full" />
          </div>
          <div className="skeleton h-7 w-16 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);

import { useLanguage } from '@/context/LanguageContext';

export const AppPageSkeleton: React.FC<{ label?: string }> = ({ label }) => {
  const { t, dir } = useLanguage();
  const displayLabel = label || t('loading');
  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none" dir={dir}>
      <Sidebar />
      <main className="flex-1 overflow-hidden p-6 pb-24 lg:p-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 flex items-center justify-between gap-4">
            <div className="space-y-3">
              <div className="skeleton h-8 w-64 rounded-2xl" />
              <div className="skeleton h-3 w-96 max-w-[70vw] rounded-full" />
            </div>
            <div className="hidden sm:block skeleton h-11 w-36 rounded-2xl" />
          </div>

          <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-[24px] border border-card-border bg-card-bg/30 p-5">
                <div className="skeleton mb-5 h-10 w-10 rounded-xl" />
                <div className="skeleton mb-3 h-8 w-20 rounded-xl" />
                <div className="skeleton h-3 w-28 rounded-full" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <SectionSkeleton rows={4} className="lg:col-span-2 min-h-[420px]" />
            <div className="space-y-6">
              <SectionSkeleton rows={2} />
              <SectionSkeleton rows={2} />
            </div>
          </div>

          <p className="mt-6 text-xs text-text-muted">{displayLabel}</p>
        </div>
      </main>
    </div>
  );
};
