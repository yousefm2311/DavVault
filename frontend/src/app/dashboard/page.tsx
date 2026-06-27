'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCommand } from '@/context/CommandContext';
import { useLanguage } from '@/context/LanguageContext';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { AppPageSkeleton, SectionSkeleton } from '@/components/LoadingStates';
import { motion } from 'framer-motion';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import {
  FolderCode,
  FileText,
  Code,
  Bug,
  Upload,
  Plus,
  Activity,
  ChevronRight,
  TrendingUp,
  Search,
  Sparkles,
  Brain,
  Boxes,
  Bell,
  Command
} from 'lucide-react';

export default function DashboardPage() {
  const { user, loading, apiFetch } = useAuth();
  const { toggleSearch } = useCommand();
  const { t, dir } = useLanguage();
  const router = useRouter();

  const [stats, setStats] = useState({
    projectsCount: 0,
    filesCount: 0,
    snippetsCount: 0,
    errorsCount: 0,
    reusableSystemsCount: 0,
    aiQueriesCount: 0,
  });
  const [projects, setProjects] = useState<any[]>([]);
  const [rawActivities, setRawActivities] = useState<any[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  // Phase 3 states
  const [standup, setStandup] = useState<string | null>(null);
  const [hiddenKnowledge, setHiddenKnowledge] = useState<any[]>([]);
  const [opportunity, setOpportunity] = useState<any>(null);
  const [generatingStandup, setGeneratingStandup] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;

    const fetchDashboardData = async () => {
      try {
        const [statsData, projectsData, knowledgeData, opportunityData, activitiesData] = await Promise.all([
          apiFetch('/search/stats'),
          apiFetch('/projects'),
          apiFetch('/ai-extensions/hidden-knowledge'),
          apiFetch('/ai-extensions/opportunity'),
          apiFetch('/ai-extensions/activities'),
        ]);

        setStats(statsData.stats || {
          projectsCount: 0,
          filesCount: 0,
          snippetsCount: 0,
          errorsCount: 0,
          reusableSystemsCount: 0,
          aiQueriesCount: 0,
        });
        setProjects((projectsData.projects || []).slice(0, 3));
        setHiddenKnowledge((knowledgeData.repeats || []).slice(0, 2));
        setOpportunity(opportunityData);
        setRawActivities(activitiesData.activities || []);
      } catch (err) {
        console.error('[Dashboard]: Data fetching failed:', err);
      } finally {
        setLoadingDashboard(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const handleGenerateStandup = async () => {
    setGeneratingStandup(true);
    try {
      const data = await apiFetch('/ai-extensions/standup');
      setStandup(data.standup);
    } catch (err) {
      console.error('[Dashboard/Standup]: Generate failed:', err);
    } finally {
      setGeneratingStandup(false);
    }
  };

  if (loading || !user) {
    return <AppPageSkeleton label={t('loading')} />;
  }

  const statCards = [
    { title: t('dashboardStatsProjects'), value: stats.projectsCount, icon: FolderCode, color: 'text-accent-blue bg-accent-blue/10' },
    { title: t('dashboardStatsFiles'), value: stats.filesCount, icon: FileText, color: 'text-success bg-success/10' },
    { title: t('dashboardStatsSnippets'), value: stats.snippetsCount, icon: Code, color: 'text-warning bg-warning/10' },
    { title: t('dashboardStatsErrors'), value: stats.errorsCount, icon: Bug, color: 'text-danger bg-danger/10' },
    { title: t('dashboardStatsSystems'), value: stats.reusableSystemsCount, icon: Boxes, color: 'text-purple bg-purple/10' },
    { title: t('dashboardStatsQueries'), value: stats.aiQueriesCount, icon: Brain, color: 'text-orange bg-orange/10' },
  ];

  const avgHealth = projects.length
    ? Math.round(projects.reduce((sum, project) => sum + (project.healthScore || 0), 0) / projects.length)
    : 0;

  const isRtl = dir === 'rtl';

  const getRelativeTimeStr = (createdAt: string) => {
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return t('activityTimeDays', { count: diffDays });
    if (diffHours > 0) return t('activityTimeHours', { count: diffHours });
    if (diffMins > 0) return t('activityTimeMins', { count: diffMins });
    return t('activityTimeNow');
  };

  const getActivityDetails = (entityType: string) => {
    if (entityType === 'project') return t('activityUploadProject');
    if (entityType === 'snippet') return t('activitySnippetsLib');
    if (entityType === 'error') return t('activityErrorsLib');
    if (entityType === 'system') return t('activityReusableSys');
    return t('activitySystemLog');
  };

  const getActivityAction = (act: any) => {
    if (act.action === 'project_uploaded') {
      return t('activityUploadedRepo', { name: act.metadata?.projectName || 'ZIP' });
    }
    return act.action;
  };

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none" dir={dir}>
      <Sidebar />

      <main className="flex-1 overflow-y-auto pb-28 lg:pb-10">
        <div className="sticky top-0 z-20 hidden border-b border-card-border bg-bg-primary/80 px-10 py-4 backdrop-blur-xl lg:flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-text-muted">{t('navDashboard')}</span>
            <span className="font-semibold text-white">{t('systemOverview')}</span>
          </div>
          <button
            onClick={toggleSearch}
            className="flex min-w-[320px] items-center rounded-2xl border border-card-border bg-card-bg/70 px-4 py-2.5 text-sm text-text-secondary transition hover:border-accent-blue/40 hover:text-white"
          >
            <Search className={`${isRtl ? 'ml-2' : 'mr-2'} h-4 w-4`} />
            {t('searchPlaceholder')}
          </button>
        </div>

        <div className="mx-auto max-w-6xl p-6 lg:p-10">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-secondary text-accent-blue ring-1 ring-card-border">
                <Command className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold tracking-tight">DevVault AI</span>
            </div>
            <div className="flex items-center gap-4">
              <Bell className="h-5 w-5 text-text-secondary" />
              <img
                src={user.avatar || 'https://lh3.googleusercontent.com/a/default-user'}
                alt={user.name}
                className="h-10 w-10 rounded-full border border-card-border object-cover"
              />
            </div>
          </div>

          {/* Header greeting */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.25em] text-text-muted lg:hidden">{t('dashboardWelcomeBack')}</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                {t('dashboardWelcomeUser', { name: user.name.split(' ')[0] })}
              </h2>
              <p className="text-xs text-text-secondary mt-1">{t('dashboardSubtitle')}</p>
            </div>
            <button
              onClick={() => router.push('/projects?action=upload')}
              className="flex items-center px-4 py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-xs font-semibold rounded-2xl transition-all shadow-md shadow-accent-blue/10 cursor-pointer"
            >
              <Plus className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
              {t('newProject')}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.7fr_0.85fr_0.85fr] mb-8">
            <div className="rounded-[28px] border border-card-border bg-card-bg/50 p-8 glass">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{t('dashboardHealthDna')}</p>
              <div className="flex flex-wrap items-end gap-4">
                <span className="text-6xl font-extrabold tracking-tight text-white"><AnimatedCounter value={avgHealth || 0} /> <span className="text-[#9DBDFF]">%</span></span>
                <span className="mb-3 text-xs font-semibold text-success">{t('indexedFromRepos')}</span>
                <span className="mb-3 text-xs text-text-muted">{t('highEngineeringMemory')}</span>
              </div>
            </div>
            <div className="rounded-[28px] border border-card-border bg-card-bg/50 p-7 glass">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{t('dashboardActiveProjects')}</p>
              <span className="text-5xl font-extrabold"><AnimatedCounter value={stats.projectsCount} /></span>
              <div className="mt-6 flex -space-x-2">
                {projects.slice(0, 4).map((project, index) => (
                  <div key={project._id} className="flex h-8 w-8 items-center justify-center rounded-full border border-bg-primary bg-[#9DBDFF] text-[10px] font-bold text-bg-primary">
                    {project.name?.slice(0, 2).toUpperCase() || index + 1}
                  </div>
                ))}
                {stats.projectsCount > 4 && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-bg-primary bg-white/10 text-[10px] font-bold text-text-secondary">
                    +{stats.projectsCount - 4}
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-[28px] border border-card-border bg-card-bg/50 p-7 glass">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{t('dashboardAiInsights')}</p>
              <span className="text-5xl font-extrabold"><AnimatedCounter value={stats.aiQueriesCount} /></span>
              <div className="mt-6 flex items-end gap-2 h-[58px]">
                {[30, 44, 38, 58, 42, 28].map((height, index) => (
                  <motion.span
                    key={index}
                    className={`block w-7 rounded bg-[#9DBDFF]/45 ${index === 3 ? 'bg-[#9DBDFF]' : ''}`}
                    initial={{ height: 0 }}
                    animate={{ height }}
                    transition={{ duration: 1.2, ease: 'easeOut', delay: index * 0.05 }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Central Spotlight Search trigger */}
          <div className="mb-8 lg:hidden">
            <div
              onClick={toggleSearch}
              className="w-full bg-card-bg/40 border border-card-border p-6 rounded-[24px] glass cursor-pointer hover:border-accent-blue/40 hover:bg-card-bg/60 transition-all duration-200 flex flex-col items-center justify-center space-y-3 relative group"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Search className="w-5 h-5 text-accent-blue" />
              </div>
              <h3 className="font-semibold text-sm">{t('dashboardSearchPlaceholder')}</h3>
              <p className="text-[10px] text-text-secondary">
                {t('dashboardSearchCommand')}
              </p>
            </div>
          </div>

          {/* Statistical Widgets grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-5 mb-8">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="bg-card-bg/40 border border-card-border p-5 rounded-[24px] glass flex items-center space-x-4"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold font-mono tracking-tight"><AnimatedCounter value={card.value} /></span>
                    <span className="text-[10px] text-text-secondary font-medium tracking-wide uppercase mt-0.5">
                      {card.title}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent projects column (2/3 width) */}
            <div className="md:col-span-2 space-y-6">
              <div className="bg-card-bg/40 border border-card-border p-7 rounded-[28px] glass">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="font-bold text-2xl">{t('dashboardProjectHealth')}</h3>
                    <p className="text-xs text-text-secondary mt-1">{t('dashboardRepoStatus')}</p>
                  </div>
                  <span
                    onClick={() => router.push('/projects')}
                    className="text-xs text-accent-blue font-semibold hover:underline flex items-center cursor-pointer text-nowrap"
                  >
                    {t('dashboardViewAll')}
                    <ChevronRight className={`w-4 h-4 ${isRtl ? 'mr-0.5 rotate-180' : 'ml-0.5'}`} />
                  </span>
                </div>

                {loadingDashboard ? (
                  <SectionSkeleton rows={3} className="border-0 bg-transparent p-0" />
                ) : projects.length > 0 ? (
                  <div className="space-y-3">
                    {projects.map((proj) => (
                      <div
                        key={proj._id}
                        onClick={() => router.push(`/projects/${proj._id}`)}
                        className="flex items-center justify-between p-4 bg-bg-primary/70 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center space-x-3.5">
                          <div className="w-9 h-9 rounded-xl bg-accent-blue/10 flex items-center justify-center">
                            <FolderCode className="w-4 h-4 text-accent-blue" />
                          </div>
                          <div className="flex flex-col ml-3">
                            <span className="text-xs font-semibold text-white">{proj.name}</span>
                            <span className="text-[10px] text-text-secondary mt-0.5 font-mono">
                              {proj.language || 'generic'} / {proj.framework || 'vanilla'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-text-secondary">{t('health')}</span>
                            <span className={`text-[10px] font-bold ${
                              proj.healthScore >= 90 ? 'text-success' : 'text-warning'
                            }`}>
                              {proj.healthScore}%
                            </span>
                          </div>
                          <ChevronRight className={`w-4 h-4 text-text-secondary ${isRtl ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-text-secondary flex flex-col items-center justify-center space-y-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-accent-blue" />
                    </div>
                    <span>{t('dashboardNoProjects')}</span>
                  </div>
                )}
              </div>

              {/* AI Suggestions / Health warnings block */}
              <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass flex items-start gap-4 border-r-accent-blue/80 border-r-4">
                <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5 text-accent-blue" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-xs text-white">{t('dashboardSmartSuggestion')}</h4>
                  <p className="text-[11px] text-text-secondary leading-relaxed mt-1">
                    {t('dashboardJWTNotice')}
                  </p>
                  <button
                    onClick={() => router.push('/chat')}
                    className="mt-3.5 px-3 py-1.5 bg-accent-blue/10 hover:bg-accent-blue/20 text-[10px] font-bold text-accent-blue rounded-xl transition-colors cursor-pointer"
                  >
                    {t('dashboardGenerateSystem')}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Activities & Notifications feed (1/3 width) */}
            <div className="bg-card-bg/40 border border-card-border p-7 rounded-[28px] glass space-y-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <Activity className="w-4 h-4 text-accent-blue" />
                  <h3 className="font-bold text-2xl">{t('dashboardActivityTitle')}</h3>
                </div>

                <div className="space-y-4">
                  {rawActivities.length > 0 ? (
                    rawActivities.map((act, i) => (
                      <div key={i} className="flex items-start gap-3 text-xs">
                        <div className="w-2 h-2 rounded-full bg-accent-blue/60 mt-1.5 flex-shrink-0"></div>
                        <div className="flex flex-col">
                          <span className="font-medium text-white">{getActivityAction(act)}</span>
                          <span className="text-[9px] text-text-secondary mt-0.5">
                            {getActivityDetails(act.entityType)} • {getRelativeTimeStr(act.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-text-secondary block py-4 text-center">{t('dashboardNoActivity')}</span>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-card-border/60">
                <button
                  onClick={() => router.push('/chat')}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 border border-card-border text-center rounded-2xl text-xs font-semibold transition-colors cursor-pointer flex justify-center items-center"
                >
                  {t('dashboardOpenChat')}
                  <ChevronRight className={`w-4 h-4 ${isRtl ? 'mr-1 rotate-180' : 'ml-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Phase 3 Advanced AI Features row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {/* AI Standup Generator card */}
            <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass flex flex-col justify-between h-[300px]">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-accent-blue" />
                  <h3 className="font-bold text-sm">{t('dashboardDailyStandup')}</h3>
                </div>
                <p className="text-[10px] text-text-secondary leading-relaxed">
                  {t('dashboardDailyReportDesc')}
                </p>
                
                {standup && (
                  <div className="mt-3 bg-bg-primary/50 border border-card-border p-3 rounded-xl max-h-[120px] overflow-y-auto text-[9px] font-mono text-text-secondary whitespace-pre-wrap select-text">
                    {standup}
                  </div>
                )}
              </div>

              <div className="mt-4">
                {standup ? (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(standup);
                      alert(t('dashboardReportCopied'));
                    }}
                    className="w-full py-2.5 bg-success/20 hover:bg-success/30 text-success border border-success/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {t('dashboardCopyReport')}
                  </button>
                ) : (
                  <button
                    onClick={handleGenerateStandup}
                    disabled={generatingStandup}
                    className="w-full py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {generatingStandup ? t('dashboardGeneratingReport') : t('dashboardGenerateReport')}
                  </button>
                )}
              </div>
            </div>

            {/* Hidden Knowledge Finder card */}
            <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass flex flex-col justify-between h-[300px]">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4.5 h-4.5 text-accent-blue" />
                  <h3 className="font-bold text-sm">{t('dashboardHiddenKnowledge')}</h3>
                </div>
                <p className="text-[10px] text-text-secondary leading-relaxed mb-4">
                  {t('dashboardHiddenKnowledgeDesc')}
                </p>

                <div className="space-y-2.5">
                  {hiddenKnowledge.length > 0 ? hiddenKnowledge.map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-white/5 border border-white/5 rounded-xl text-[10px]">
                      <span className="font-bold text-white block">{item.title}</span>
                      <span className="text-text-secondary block mt-0.5 leading-normal">{item.description}</span>
                    </div>
                  )) : (
                    <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-[10px] text-text-secondary">
                      {t('dashboardNoRepeats')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Opportunity Engine card */}
            <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass flex flex-col justify-between h-[300px]">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-accent-blue" />
                  <h3 className="font-bold text-sm">{t('dashboardOpportunityTitle')}</h3>
                </div>
                <p className="text-[10px] text-text-secondary leading-relaxed mb-4">
                  {t('dashboardOpportunityDesc')}
                </p>

                {opportunity && (
                  <div className="p-3 bg-accent-blue/10 border border-accent-blue/20 rounded-xl text-[10px]">
                    <span className="font-bold text-accent-blue block">SaaS Opportunity:</span>
                    <span className="text-text-secondary block mt-1 leading-normal">
                      {opportunity.recommendation}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => router.push('/systems')}
                className="w-full py-2.5 bg-white/5 border border-card-border hover:bg-white/10 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                {t('dashboardExportBlueprint')}
              </button>
            </div>
          </div>
        </div>
      </main>

      <CommandPalette />
    </div>
  );
}
