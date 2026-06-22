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
  AlertCircle
} from 'lucide-react';

export default function DeveloperDNAPage() {
  const { user, loading, apiFetch } = useAuth();
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

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none" dir={dir}>
      <Sidebar />

      <main className="flex-1 p-10 overflow-y-auto max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tech Stack widget */}
              <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass space-y-4">
                <h3 className="font-bold text-sm">{t('favoriteTechs')}</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                    <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold block">{t('dnaLanguage')}</span>
                    <span className="text-sm font-semibold text-white font-mono mt-0.5 block">{dna.favoriteStack.language}</span>
                  </div>
                  <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                    <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold block">{t('dnaFramework')}</span>
                    <span className="text-sm font-semibold text-white font-mono mt-0.5 block">{dna.favoriteStack.framework}</span>
                  </div>
                  <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                    <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold block">{t('dnaDatabase')}</span>
                    <span className="text-sm font-semibold text-white font-mono mt-0.5 block">{dna.favoriteStack.database}</span>
                  </div>
                </div>
              </div>

              {/* Developer Strengths (1/2 width) */}
              <div className="md:col-span-2 bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass space-y-4">
                <h3 className="font-bold text-sm">{t('engineeringStrengths')}</h3>
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">{t('backendSystems')}</span>
                      <span className="font-semibold text-white font-mono">{dna.strengths.backend}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-accent-blue h-1.5 rounded-full" style={{ width: `${dna.strengths.backend}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">{t('frontendInterfaces')}</span>
                      <span className="font-semibold text-white font-mono">{dna.strengths.frontend}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-success h-1.5 rounded-full" style={{ width: `${dna.strengths.frontend}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">{t('mobileApps')}</span>
                      <span className="font-semibold text-white font-mono">{dna.strengths.mobile}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-warning h-1.5 rounded-full" style={{ width: `${dna.strengths.mobile}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">{t('devopsCloud')}</span>
                      <span className="font-semibold text-white font-mono">{dna.strengths.devops}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-danger h-1.5 rounded-full" style={{ width: `${dna.strengths.devops}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Coding DNA Checker (Code DNA) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start select-text">
              {/* Left pane: Paste input */}
              <div className="md:col-span-2 bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass space-y-4">
                <div className="flex items-center gap-2">
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
                      className="px-5 py-2.5 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-accent-blue/50 text-white rounded-2xl text-xs font-semibold cursor-pointer"
                    >
                      {checkingStyle ? t('analyzingStyle') : t('checkStyleMatch')}
                    </button>
                  </div>
                </form>
              </div>

              {/* Right pane: style similarity results */}
              <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass flex flex-col min-h-[300px]">
                {styleResult ? (
                  <div className="space-y-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-center mb-4">
                        <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold block">{t('styleSimilarity')}</span>
                        <span className="text-4xl font-extrabold text-white mt-1 block font-mono">
                          {styleResult.similarity}%
                        </span>
                      </div>

                      <div className="space-y-3.5">
                        {styleResult.suggestions.map((sug: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-[11px]">
                            {styleResult.styleMatch ? (
                              <CheckCircle2 className="w-4 h-4 text-success ml-1.5 flex-shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-warning ml-1.5 flex-shrink-0 mt-0.5" />
                            )}
                            <span className="text-text-secondary leading-relaxed">{sug}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center text-xs text-text-secondary flex flex-col items-center justify-center space-y-3 h-full justify-center">
                    <Brain className="w-6 h-6 text-accent-blue opacity-50" />
                    <span>{t('pasteCodeToCompare')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-text-secondary">
            {t('errorLoadingDna')}
          </div>
        )}
      </main>

      <CommandPalette />
    </div>
  );
}
