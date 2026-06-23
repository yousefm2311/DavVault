'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { AppPageSkeleton, SectionSkeleton } from '@/components/LoadingStates';
import { useLanguage } from '@/context/LanguageContext';
import {
  Brain,
  Sparkles,
  TrendingUp,
  Cpu,
  Layers,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Search,
  Bell,
  HelpCircle,
  LogOut,
  Command,
  Workflow
} from 'lucide-react';

export default function DeveloperDNAPage() {
  const { user, loading, apiFetch, logout } = useAuth();
  const router = useRouter();
  const { t, dir } = useLanguage();

  const [dna, setDna] = useState<any>(null);
  const [loadingDna, setLoadingDna] = useState(true);

  // Style check state
  const [codeToCheck, setCodeToCheck] = useState('');
  const [checkingStyle, setCheckingStyle] = useState(false);
  const [styleResult, setStyleResult] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

  const fetchDNA = async () => {
    try {
      const data = await apiFetch('/developer-dna');
      setDna(data);
    } catch (err) {
      console.error('[DNA]: Failed to fetch DNA profile:', err);
    } finally {
      setLoadingDna(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchDNA();
  }, [user]);

  const handleStyleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeToCheck.trim()) return;

    setCheckingStyle(true);
    setStyleResult(null);
    try {
      const data = await apiFetch('/developer-dna/compare', {
        method: 'POST',
        body: JSON.stringify({ code: codeToCheck }),
      });
      setStyleResult(data);
    } catch (err) {
      console.error('[DNA]: Style check failed:', err);
    } finally {
      setCheckingStyle(false);
    }
  };

  if (loading || !user) return <AppPageSkeleton label={t('loadingDna')} />;

  const isRtl = dir === 'rtl';

  // Format lines of code nicely (e.g. 14.2k LOC)
  const formatLOC = (loc: number) => {
    if (loc >= 1000) {
      return `${(loc / 1000).toFixed(1)}k LOC`;
    }
    return `${loc} LOC`;
  };

  // Construct dynamic SVG growth curve path
  let growthPath = '';
  let growthAreaPath = '';
  if (dna && dna.skillGrowthCurve) {
    const points = dna.skillGrowthCurve.map((val: number, i: number) => ({
      x: i * 160,
      y: 190 - (val * 1.6), // scale score 0-100 to y=190 down to y=30
    }));

    growthPath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + 80;
      const cpY1 = p0.y;
      const cpX2 = p1.x - 80;
      const cpY2 = p1.y;
      growthPath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    growthAreaPath = `${growthPath} L 800 200 L 0 200 Z`;
  }

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none" dir={dir}>
      <Sidebar />

      <main className="flex-1 flex flex-col bg-bg-primary overflow-hidden min-h-screen">
        {/* TopAppBar */}
        <header className="sticky top-0 z-20 hidden border-b border-card-border bg-bg-primary/80 px-10 py-4 backdrop-blur-xl lg:flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-bold tracking-tight text-white">{t('dnaTitle')}</h2>
            <div className="hidden md:flex gap-6">
              <span className="text-xs font-semibold text-text-primary border-b-2 border-accent-blue pb-1 cursor-default">{t('dnaAnalytics')}</span>
              <span className="text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer">{t('dnaPerformance')}</span>
              <span className="text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer">{t('dnaSecurity')}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <input
                className="w-64 h-10 pl-10 pr-4 bg-card-bg border border-card-border rounded-full text-xs focus:outline-none focus:ring-1 focus:ring-accent-blue/50 transition-all text-text-primary"
                placeholder={t('searchInsights')}
                type="text"
              />
              <Search className="w-4 h-4 absolute left-3 top-3 text-text-muted" />
            </div>
            <button
              onClick={() => {
                setLoadingDna(true);
                fetchDNA();
              }}
              className="p-2.5 bg-white/5 border border-card-border hover:bg-white/10 rounded-xl text-text-secondary hover:text-white transition-all cursor-pointer"
              title={t('updateDna')}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button className="px-5 py-2 bg-accent-blue text-white rounded-full text-xs font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer">
              {t('deployDna')}
            </button>
          </div>
        </header>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="mx-auto max-w-5xl space-y-6">
            {/* Header info (Mobile view) */}
            <div className="flex items-center justify-between mb-2 lg:hidden">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{t('dnaTitle')}</h2>
                <p className="text-xs text-text-secondary mt-1">{t('dnaSubtitle')}</p>
              </div>
              <button
                onClick={() => {
                  setLoadingDna(true);
                  fetchDNA();
                }}
                className="p-2.5 bg-white/5 border border-card-border hover:bg-white/10 rounded-xl text-text-secondary hover:text-white transition-all cursor-pointer"
                title={t('updateDna')}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {loadingDna ? (
              <SectionSkeleton rows={5} className="min-h-[420px]" />
            ) : dna ? (
              <div className="space-y-6">
                {/* Upper Bento Grid */}
                <div className="grid grid-cols-12 gap-6">
                  {/* Widget 1: Productivity Score */}
                  <div className="col-span-12 lg:col-span-5 bg-card-bg/40 border border-card-border p-6 lg:p-8 rounded-[28px] glass flex flex-col items-center justify-center relative overflow-hidden group hover:border-white/12 transition-all duration-200">
                    <h3 className="text-text-secondary font-semibold text-[11px] mb-6 tracking-widest uppercase text-center w-full">
                      {t('productivityScore')}
                    </h3>
                    <div className="relative w-56 h-56 flex items-center justify-center">
                      <svg className="w-full h-full ring-progress">
                        <circle cx="112" cy="112" fill="transparent" r="96" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="12"></circle>
                        <circle
                          cx="112"
                          cy="112"
                          fill="transparent"
                          r="96"
                          stroke="url(#gradientScore)"
                          strokeDasharray="603"
                          strokeDashoffset={603 - (603 * (dna.productivityScore || 0)) / 100}
                          strokeLinecap="round"
                          strokeWidth="12"
                        ></circle>
                        <defs>
                          <linearGradient id="gradientScore" x1="0%" x2="100%" y1="0%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#3e90ff', stopOpacity: 1 }}></stop>
                            <stop offset="100%" style={{ stopColor: '#0A84FF', stopOpacity: 1 }}></stop>
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="font-bold text-text-primary text-[72px] leading-none select-text">
                          {dna.productivityScore || 0}
                        </span>
                        <span className="text-[11px] text-success flex items-center gap-1 mt-1 font-bold">
                          <TrendingUp className="w-3.5 h-3.5" /> {dna.productivityGrowth || '+0%'}
                        </span>
                      </div>
                    </div>
                    <p className="mt-6 text-text-secondary text-xs text-center max-w-xs leading-relaxed">
                      {t('productivityDescription')}
                    </p>
                  </div>

                  {/* Widget 2: Technology Breakdown (Concentric rings) */}
                  <div className="col-span-12 lg:col-span-7 bg-card-bg/40 border border-card-border p-6 lg:p-8 rounded-[28px] glass flex flex-col justify-between group hover:border-white/12 transition-all duration-200">
                    <div className="mb-6">
                      <h3 className="font-bold text-lg text-text-primary">{t('techBreakdown')}</h3>
                      <p className="text-text-secondary text-xs mt-0.5">{t('techBreakdownSubtitle')}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-8 lg:gap-12 flex-1 justify-center">
                      <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full ring-progress" viewBox="0 0 200 200">
                          {/* Background nested tracks */}
                          <circle cx="100" cy="100" r="80" fill="transparent" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="10" />
                          <circle cx="100" cy="100" r="62" fill="transparent" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="10" />
                          <circle cx="100" cy="100" r="44" fill="transparent" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="10" />
                          <circle cx="100" cy="100" r="26" fill="transparent" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="10" />

                          {/* Nested Activity Rings */}
                          {/* Web Engine - Outer (Purple #e9b3ff) */}
                          <circle
                            cx="100"
                            cy="100"
                            r="80"
                            fill="transparent"
                            stroke="#e9b3ff"
                            strokeWidth="10"
                            strokeDasharray="502"
                            strokeDashoffset={502 - (502 * (dna.technologyBreakdown?.webEngine || 0)) / 100}
                            strokeLinecap="round"
                          />
                          {/* Cloud Native - Middle Outer (Blue #3e90ff) */}
                          <circle
                            cx="100"
                            cy="100"
                            r="62"
                            fill="transparent"
                            stroke="#3e90ff"
                            strokeWidth="10"
                            strokeDasharray="389"
                            strokeDashoffset={389 - (389 * (dna.technologyBreakdown?.cloudNative || 0)) / 100}
                            strokeLinecap="round"
                          />
                          {/* Machine Learning - Middle Inner (Orange #FF9F0A) */}
                          <circle
                            cx="100"
                            cy="100"
                            r="44"
                            fill="transparent"
                            stroke="#FF9F0A"
                            strokeWidth="10"
                            strokeDasharray="276"
                            strokeDashoffset={276 - (276 * (dna.technologyBreakdown?.machineLearning || 0)) / 100}
                            strokeLinecap="round"
                          />
                          {/* Legacy Support - Innermost (Gray #71717A) */}
                          <circle
                            cx="100"
                            cy="100"
                            r="26"
                            fill="transparent"
                            stroke="#71717A"
                            strokeWidth="10"
                            strokeDasharray="163"
                            strokeDashoffset={163 - (163 * (dna.technologyBreakdown?.legacySupport || 0)) / 100}
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>

                      <div className="flex-1 w-full space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-3 h-3 rounded-full bg-[#e9b3ff]" />
                            <span className="text-text-primary text-xs font-semibold">{t('webEngine')}</span>
                          </div>
                          <span className="font-mono text-xs text-text-secondary select-text">
                            {dna.technologyBreakdown?.webEngine || 0}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-3 h-3 rounded-full bg-[#3e90ff]" />
                            <span className="text-text-primary text-xs font-semibold">{t('cloudNative')}</span>
                          </div>
                          <span className="font-mono text-xs text-text-secondary select-text">
                            {dna.technologyBreakdown?.cloudNative || 0}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-3 h-3 rounded-full bg-[#FF9F0A]" />
                            <span className="text-text-primary text-xs font-semibold">{t('machineLearning')}</span>
                          </div>
                          <span className="font-mono text-xs text-text-secondary select-text">
                            {dna.technologyBreakdown?.machineLearning || 0}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-3 h-3 rounded-full bg-[#71717A]" />
                            <span className="text-text-primary text-xs font-semibold">{t('legacySupport')}</span>
                          </div>
                          <span className="font-mono text-xs text-text-secondary select-text">
                            {dna.technologyBreakdown?.legacySupport || 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Middle Bento Grid */}
                <div className="grid grid-cols-12 gap-6">
                  {/* Widget 3: Top Languages */}
                  <div className="col-span-12 md:col-span-5 bg-card-bg/40 border border-card-border p-6 lg:p-8 rounded-[28px] glass flex flex-col justify-between group hover:border-white/12 transition-all duration-200">
                    <h3 className="font-bold text-lg text-text-primary mb-6">{t('topLanguages')}</h3>
                    <div className="space-y-6">
                      {dna.topLanguages && dna.topLanguages.map((lang: any) => (
                        <div key={lang.name} className="space-y-2 select-text">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-mono font-bold text-text-primary">{lang.name}</span>
                            <span className="text-text-secondary">{formatLOC(lang.loc)}</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-accent-blue/80 to-accent-blue"
                              style={{ width: `${lang.pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Widget 4: Skill Growth Curve */}
                  <div className="col-span-12 md:col-span-7 bg-card-bg/40 border border-card-border p-6 lg:p-8 rounded-[28px] glass flex flex-col justify-between group hover:border-white/12 transition-all duration-200 overflow-hidden relative">
                    <div className="mb-4">
                      <h3 className="font-bold text-lg text-text-primary">{t('skillGrowthCurve')}</h3>
                      <p className="text-text-secondary text-xs mt-0.5">{t('expertiseVelocity')}</p>
                    </div>
                    {dna.skillGrowthCurve && (
                      <div className="flex-1 flex flex-col justify-between mt-4">
                        <div className="h-44 w-full flex items-end">
                          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 200">
                            {/* Smooth dynamic curve path */}
                            <path d={growthPath} fill="none" stroke="#3e90ff" strokeWidth="4" strokeLinecap="round" />
                            <path d={growthAreaPath} fill="url(#graphGradient)" />
                            <defs>
                              <linearGradient id="graphGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                                <stop offset="0%" style={{ stopColor: '#3e90ff', stopOpacity: 0.15 }}></stop>
                                <stop offset="100%" style={{ stopColor: '#3e90ff', stopOpacity: 0 }}></stop>
                              </linearGradient>
                            </defs>
                            {/* Indicator Dot on the last point */}
                            <circle
                              cx={5 * 160}
                              cy={190 - (dna.skillGrowthCurve[5] * 1.6)}
                              fill="#FFFFFF"
                              r="6"
                              className="shadow-lg shadow-black"
                            />
                          </svg>
                        </div>
                        <div className="flex justify-between mt-4 font-mono text-[9px] text-text-muted uppercase tracking-tighter">
                          <span>Jan</span>
                          <span>Feb</span>
                          <span>Mar</span>
                          <span>Apr</span>
                          <span>May</span>
                          <span>Jun</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lower Bento Grid */}
                <div className="grid grid-cols-12 gap-6">
                  {/* Widget 5: Favorite Architecture Pattern */}
                  <div className="col-span-12 md:col-span-6 bg-card-bg/40 border border-card-border p-6 lg:p-8 rounded-[28px] glass flex gap-6 items-start group hover:border-white/12 transition-all duration-200">
                    <div className="w-14 h-14 rounded-[20px] bg-accent-blue/10 flex items-center justify-center shrink-0 border border-accent-blue/15 mt-1">
                      <Workflow className="w-6 h-6 text-accent-blue" />
                    </div>
                    <div className="space-y-2 select-text">
                      <span className="text-[9px] text-text-secondary uppercase tracking-widest font-bold block">
                        {t('preferredPattern')}
                      </span>
                      <h3 className="text-text-primary font-bold text-lg leading-tight">
                        {dna.preferredPattern?.title || 'Layered MVC Architecture'}
                      </h3>
                      <p className="text-text-secondary text-xs leading-relaxed">
                        {dna.preferredPattern?.description || ''}
                      </p>
                    </div>
                  </div>

                  {/* Widget 6: Stylistic Identity */}
                  <div className="col-span-12 md:col-span-6 bg-card-bg/40 border border-card-border p-6 lg:p-8 rounded-[28px] glass flex flex-col justify-between group hover:border-white/12 transition-all duration-200 bg-gradient-to-br from-card-bg/40 to-[#1e1e24]/20">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
                        <span className="text-accent-blue font-bold tracking-widest uppercase text-[10px]">
                          {t('stylisticIdentity')}
                        </span>
                      </div>
                      <h3 className="font-bold text-text-primary text-xl leading-tight select-text">
                        {dna.stylisticIdentity?.title || ''}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4 select-text">
                      {dna.stylisticIdentity?.tags && dna.stylisticIdentity.tags.map((tag: string) => (
                        <span
                          key={tag}
                          className="px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-card-border text-[10px] font-semibold text-text-primary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Coding DNA Checker (Code DNA) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start select-text">
                  {/* Left pane: Paste input */}
                  <div className="md:col-span-2 bg-card-bg/40 border border-card-border p-6 lg:p-8 rounded-[28px] glass space-y-4 group hover:border-white/12 transition-all duration-200">
                    <div className="flex items-center gap-2.5">
                      <Cpu className="w-5 h-5 text-accent-blue" />
                      <h3 className="font-bold text-sm">{t('codeStyleScanner')}</h3>
                    </div>
                    <p className="text-[11px] text-text-secondary leading-relaxed">
                      {t('pasteToCompareStyle', { style: dna.namingStyle })}
                    </p>

                    <form onSubmit={handleStyleCheck} className="space-y-4">
                      <textarea
                        placeholder={t('pasteCodeHere')}
                        value={codeToCheck}
                        onChange={(e) => setCodeToCheck(e.target.value)}
                        rows={8}
                        className="w-full bg-bg-primary/50 border border-card-border rounded-2xl p-4 text-xs font-mono text-[#E0E0E0] outline-none focus:border-accent-blue/50"
                        required
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={checkingStyle || !codeToCheck.trim()}
                          className="px-5 py-2.5 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-accent-blue/50 text-white rounded-2xl text-xs font-semibold cursor-pointer transition-all shadow-md shadow-accent-blue/15"
                        >
                          {checkingStyle ? t('analyzingStyle') : t('checkStyleMatch')}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Right pane: style similarity results */}
                  <div className="bg-card-bg/40 border border-card-border p-6 lg:p-8 rounded-[28px] glass flex flex-col min-h-[300px] group hover:border-white/12 transition-all duration-200 justify-center">
                    {styleResult ? (
                      <div className="space-y-5 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="text-center mb-6">
                            <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold block">
                              {t('styleSimilarity')}
                            </span>
                            <span className="text-5xl font-extrabold text-white mt-1 block font-mono select-all">
                              {styleResult.similarity}%
                            </span>
                          </div>

                          <div className="space-y-4">
                            {styleResult.suggestions && styleResult.suggestions.map((sug: string, i: number) => (
                              <div key={i} className="flex items-start gap-2.5 text-[11px] leading-relaxed select-text">
                                {styleResult.styleMatch ? (
                                  <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                                )}
                                <span className="text-text-secondary">{sug}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-16 text-center text-xs text-text-secondary flex flex-col items-center justify-center space-y-3 h-full">
                        <Brain className="w-8 h-8 text-accent-blue/50" />
                        <span>{t('pasteCodeToCompare')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-text-secondary bg-card-bg/40 border border-card-border rounded-[28px] glass">
                {t('errorLoadingDna')}
              </div>
            )}
          </div>
        </div>
      </main>

      <CommandPalette />
    </div>
  );
}
