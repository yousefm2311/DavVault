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
  const isRtl = dir === 'rtl';

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none" dir={dir}>
      {/* SideNavBar Skeleton */}
      <aside className={`hidden lg:flex w-72 bg-bg-secondary ${isRtl ? 'border-l' : 'border-r'} border-card-border flex-col p-5 h-screen sticky top-0 shrink-0`}>
        <div className="px-1 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg skeleton shrink-0" />
            <div>
              <h1 className="font-bold text-[21px] leading-none text-white">DevVault AI</h1>
              <p className="text-[10px] text-text-muted mt-1.5 tracking-wider uppercase font-bold">Elite Developer Suite</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 space-y-2">
          {/* Active state skeleton */}
          <div className="bg-white/10 flex items-center gap-3 px-4 py-3 rounded-xl border-l-2 border-accent-blue">
            <div className="w-5 h-5 rounded skeleton shrink-0" />
            <div className="w-20 h-4 skeleton" />
          </div>
          {/* Other items skeletons */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl">
              <div className="w-5 h-5 rounded skeleton shrink-0 opacity-40" />
              <div className="w-24 h-4 skeleton opacity-40" />
            </div>
          ))}
        </nav>
        
        <div className="mt-auto space-y-6">
          {/* Storage container */}
          <div className="p-4 rounded-2xl bg-card-bg/40 border border-card-border">
            <div className="flex justify-between items-center mb-2">
              <div className="w-16 h-3 skeleton" />
              <div className="w-8 h-3 skeleton" />
            </div>
            <div className="w-full h-1.5 bg-bg-primary rounded-full overflow-hidden">
              <div className="w-3/4 h-full bg-accent-blue/80 rounded-full" />
            </div>
          </div>
          {/* User profile */}
          <div className="flex items-center gap-3 px-2 py-1 opacity-50">
            <div className="w-9 h-9 rounded-full skeleton shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="w-20 h-3.5 skeleton mb-1.5" />
              <div className="w-12 h-2.5 skeleton" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main block */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Header skeleton */}
        <header className="sticky top-0 z-20 hidden border-b border-card-border bg-bg-primary/80 px-10 py-4 backdrop-blur-xl lg:flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 skeleton rounded" />
            <div className="w-24 h-4 skeleton rounded" />
          </div>
          <div className="flex items-center gap-6">
            <div className="relative w-64 h-10 bg-card-bg border border-card-border rounded-full flex items-center px-4">
              <div className={`w-4 h-4 skeleton rounded-full ${isRtl ? 'ml-2' : 'mr-2'} opacity-55`} />
              <div className="w-32 h-3 skeleton opacity-40" />
            </div>
            <div className="flex items-center gap-4">
              <div className="w-5 h-5 rounded skeleton opacity-55" />
              <div className="w-5 h-5 rounded skeleton opacity-55" />
              <button className="bg-accent-blue/50 text-white px-5 py-2 rounded-full text-xs font-bold opacity-50 cursor-default">
                Deploy
              </button>
            </div>
          </div>
        </header>

        {/* Main content scrollable area */}
        <main className="flex-1 overflow-y-auto p-6 pb-24 lg:p-10">
          <div className="mx-auto max-w-5xl">
            {/* Dashboard Header skeleton */}
            <div className="mb-8">
              <div className="w-48 h-8 skeleton mb-2" />
              <div className="w-96 max-w-[70vw] h-4 skeleton opacity-60" />
            </div>

            {/* Bento grid section */}
            <div className="grid grid-cols-12 gap-6 mb-8">
              {/* Large widget skeleton */}
              <div className="col-span-12 lg:col-span-7 bg-card-bg/40 border border-card-border rounded-[24px] p-6 lg:p-8 flex flex-col lg:flex-row items-center justify-between gap-6 min-h-[280px]">
                <div className="flex-1 space-y-4">
                  <div className="w-32 h-4 skeleton opacity-50" />
                  <div className="w-64 max-w-[60vw] h-10 skeleton" />
                  <div className="w-48 max-w-[50vw] h-4 skeleton opacity-40" />
                </div>
                <div className="w-36 h-36 rounded-full border-[12px] border-card-bg flex items-center justify-center shrink-0">
                  <div className="w-24 h-24 rounded-full skeleton opacity-20" />
                </div>
              </div>
              
              {/* Small widget skeleton */}
              <div className="col-span-12 lg:col-span-5 bg-card-bg/40 border border-card-border rounded-[24px] p-6 lg:p-8 flex flex-col justify-between min-h-[280px]">
                <div className="space-y-4">
                  <div className="w-40 h-5 skeleton" />
                  <div className="w-56 h-3 skeleton opacity-50" />
                </div>
                <div className="space-y-3 mt-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-white/10" />
                        <div className="w-20 h-3.5 skeleton" />
                      </div>
                      <div className="w-8 h-3.5 skeleton" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Lower section */}
            <div className="grid grid-cols-12 gap-6">
              {/* Recent activity timeline skeleton */}
              <div className="col-span-12 lg:col-span-7 bg-card-bg/40 border border-card-border rounded-[24px] p-6 lg:p-8">
                <div className="flex justify-between items-center mb-6">
                  <div className="w-40 h-5 skeleton" />
                  <div className="w-20 h-4 skeleton opacity-40" />
                </div>
                <div className={`space-y-6 relative before:absolute ${isRtl ? 'before:right-[11px]' : 'before:left-[11px]'} before:top-2 before:bottom-2 before:w-[2px] before:bg-white/5`}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-4 relative">
                      <div className="w-6 h-6 rounded-full bg-bg-secondary relative z-10 border-4 border-card-bg" />
                      <div className="flex-1 space-y-2">
                        <div className="w-48 max-w-[50vw] h-4 skeleton" />
                        {i === 0 && <div className="w-full h-16 skeleton rounded-xl opacity-20" />}
                        <div className="w-24 h-3 skeleton opacity-40" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick stats and actions column */}
              <div className="col-span-12 lg:col-span-5 space-y-6">
                {/* Project grid skeleton */}
                <div className="bg-card-bg/40 border border-card-border rounded-[24px] p-6">
                  <div className="w-32 h-5 skeleton mb-5" />
                  <div className="grid grid-cols-2 gap-4">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="aspect-square bg-bg-primary/50 border border-card-border rounded-2xl p-4 flex flex-col justify-between">
                        <div className="w-8 h-8 rounded-lg skeleton opacity-40" />
                        <div className="w-full h-3.5 skeleton opacity-50" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-card-bg/40 border border-card-border rounded-[24px] p-6">
                  <div className="w-32 h-5 skeleton mb-4" />
                  <div className="space-y-3">
                    <div className="w-full h-11 skeleton rounded-xl opacity-30" />
                    <div className="w-full h-11 skeleton rounded-xl opacity-30" />
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-8 text-xs text-text-muted">{displayLabel}</p>
          </div>
        </main>
      </div>
    </div>
  );
};

