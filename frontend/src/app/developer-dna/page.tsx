'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
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

  if (loading || !user) return null;

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none">
      <Sidebar />

      <main className="flex-1 p-10 overflow-y-auto max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Developer DNA</h2>
            <p className="text-xs text-text-secondary mt-1">AI-extracted engineering profile and coding metrics</p>
          </div>
          <button
            onClick={() => {
              setLoadingDna(true);
              fetchDNA();
            }}
            className="p-2.5 bg-white/5 border border-card-border hover:bg-white/10 rounded-xl text-text-secondary hover:text-white transition-all cursor-pointer"
            title="Refresh DNA profile"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loadingDna ? (
          <div className="py-20 flex justify-center bg-card-bg/25 border border-card-border rounded-[28px] glass">
            <div className="w-6 h-6 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
          </div>
        ) : dna ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tech Stack widget */}
              <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass space-y-4">
                <h3 className="font-bold text-sm">Preferred Stack</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                    <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold block">Language</span>
                    <span className="text-sm font-semibold text-white font-mono mt-0.5 block">{dna.favoriteStack.language}</span>
                  </div>
                  <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                    <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold block">Framework</span>
                    <span className="text-sm font-semibold text-white font-mono mt-0.5 block">{dna.favoriteStack.framework}</span>
                  </div>
                  <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                    <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold block">Database</span>
                    <span className="text-sm font-semibold text-white font-mono mt-0.5 block">{dna.favoriteStack.database}</span>
                  </div>
                </div>
              </div>

              {/* Developer Strengths (1/2 width) */}
              <div className="md:col-span-2 bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass space-y-4">
                <h3 className="font-bold text-sm">Engineering Strengths</h3>
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Backend Systems</span>
                      <span className="font-semibold text-white font-mono">{dna.strengths.backend}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-accent-blue h-1.5 rounded-full" style={{ width: `${dna.strengths.backend}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Frontend User Interfaces</span>
                      <span className="font-semibold text-white font-mono">{dna.strengths.frontend}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-success h-1.5 rounded-full" style={{ width: `${dna.strengths.frontend}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Mobile (Flutter / Android)</span>
                      <span className="font-semibold text-white font-mono">{dna.strengths.mobile}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-warning h-1.5 rounded-full" style={{ width: `${dna.strengths.mobile}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">DevOps & Cloud Configuration</span>
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
                <div className="flex items-center space-x-2">
                  <Cpu className="w-5 h-5 text-accent-blue" />
                  <h3 className="font-bold text-sm">Code DNA Style Checker</h3>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Paste any code block to compare variable names, brackets spacing, error catch structures, and design layout rules to your historical naming profile ({dna.namingStyle}).
                </p>

                <form onSubmit={handleStyleCheck} className="space-y-4">
                  <textarea
                    placeholder="Paste code segment here..."
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
                      {checkingStyle ? 'Analyzing Naming style...' : 'Check Naming Match'}
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
                        <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold block">Style Similarity</span>
                        <span className="text-4xl font-extrabold text-white mt-1 block font-mono">
                          {styleResult.similarity}%
                        </span>
                      </div>

                      <div className="space-y-3.5">
                        {styleResult.suggestions.map((sug: string, i: number) => (
                          <div key={i} className="flex items-start space-x-2 text-[11px]">
                            {styleResult.styleMatch ? (
                              <CheckCircle2 className="w-4 h-4 text-success mr-1.5 flex-shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-warning mr-1.5 flex-shrink-0 mt-0.5" />
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
                    <span>Paste a code block on the left to verify its naming style similarity score.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-text-secondary">
            Failed to load engineering DNA. Index projects first to count coding profiles.
          </div>
        )}
      </main>

      <CommandPalette />
    </div>
  );
}
