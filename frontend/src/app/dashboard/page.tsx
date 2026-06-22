'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCommand } from '@/context/CommandContext';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import {
  FolderCode,
  FileText,
  Code,
  Bug,
  Upload,
  Plus,
  Terminal,
  Activity,
  ChevronRight,
  TrendingUp,
  FileCode,
  Search,
  Sparkles,
  Brain
} from 'lucide-react';

export default function DashboardPage() {
  const { user, loading, apiFetch } = useAuth();
  const { toggleSearch } = useCommand();
  const router = useRouter();

  const [stats, setStats] = useState({
    projectsCount: 0,
    filesCount: 0,
    snippetsCount: 0,
    errorsCount: 0,
  });
  const [projects, setProjects] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
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

        setStats(statsData.stats || { projectsCount: 0, filesCount: 0, snippetsCount: 0, errorsCount: 0 });
        setProjects((projectsData.projects || []).slice(0, 3));
        setHiddenKnowledge((knowledgeData.repeats || []).slice(0, 2));
        setOpportunity(opportunityData);

        // Map real backend activity logs to state format
        const realActivities = (activitiesData.activities || []).map((act: any) => {
          let details = 'System Log';
          if (act.entityType === 'project') details = 'Project Upload';
          else if (act.entityType === 'snippet') details = 'Snippet Library';
          else if (act.entityType === 'error') details = 'Error Library';
          else if (act.entityType === 'system') details = 'Reusable System';

          // Format relative time
          const diffMs = Date.now() - new Date(act.createdAt).getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMins / 60);
          const diffDays = Math.floor(diffHours / 24);

          let timeStr = 'Just now';
          if (diffDays > 0) timeStr = `${diffDays}d ago`;
          else if (diffHours > 0) timeStr = `${diffHours}h ago`;
          else if (diffMins > 0) timeStr = `${diffMins}m ago`;

          // Human friendly action text
          let actionText = act.action;
          if (act.action === 'project_uploaded') {
            actionText = `Uploaded repository: ${act.metadata?.projectName || 'zip project'}`;
          }

          return {
            action: actionText,
            details,
            time: timeStr
          };
        });

        setActivities(realActivities);
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
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center text-sm text-text-secondary select-none">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
          <span>Loading developer profile...</span>
        </div>
      </div>
    );
  }

  const statCards = [
    { title: 'Projects', value: stats.projectsCount, icon: FolderCode, color: 'text-accent-blue bg-accent-blue/10' },
    { title: 'Files Indexed', value: stats.filesCount, icon: FileText, color: 'text-success bg-success/10' },
    { title: 'AI Snippets', value: stats.snippetsCount, icon: Code, color: 'text-warning bg-warning/10' },
    { title: 'Resolved Errors', value: stats.errorsCount, icon: Bug, color: 'text-danger bg-danger/10' },
  ];

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none">
      <Sidebar />

      <main className="flex-1 p-10 overflow-y-auto max-w-5xl mx-auto">
        {/* Header greeting */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Good evening, {user.name.split(' ')[0]}</h2>
            <p className="text-xs text-text-secondary mt-1">Here is a summary of your synced engineering memory</p>
          </div>
          <button
            onClick={() => router.push('/projects?action=upload')}
            className="flex items-center px-4 py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-xs font-semibold rounded-2xl transition-all shadow-md shadow-accent-blue/10 cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Project
          </button>
        </div>

        {/* Central Spotlight Search trigger */}
        <div className="mb-12">
          <div
            onClick={toggleSearch}
            className="w-full bg-card-bg/40 border border-card-border p-6 rounded-[24px] glass cursor-pointer hover:border-accent-blue/40 hover:bg-card-bg/60 transition-all duration-200 flex flex-col items-center justify-center space-y-3 relative group"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Search className="w-5 h-5 text-accent-blue" />
            </div>
            <h3 className="font-semibold text-sm">Search your engineering brain...</h3>
            <p className="text-[10px] text-text-secondary">
              Press <kbd className="bg-bg-primary border border-card-border px-1.5 py-0.5 rounded-md font-mono text-[9px]">⌘K</kbd> to query codes, projects or solutions.
            </p>
          </div>
        </div>

        {/* Statistical Widgets grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10">
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
                  <span className="text-2xl font-bold font-mono tracking-tight">{card.value}</span>
                  <span className="text-[10px] text-text-secondary font-medium tracking-wide uppercase mt-0.5">
                    {card.title}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Recent projects column (2/3 width) */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-sm">Recent Repositories</h3>
                <span
                  onClick={() => router.push('/projects')}
                  className="text-xs text-accent-blue font-semibold hover:underline flex items-center cursor-pointer"
                >
                  View all
                  <ChevronRight className="w-4 h-4 ml-0.5" />
                </span>
              </div>

              {loadingDashboard ? (
                <div className="py-12 flex justify-center">
                  <div className="w-5 h-5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
                </div>
              ) : projects.length > 0 ? (
                <div className="space-y-3">
                  {projects.map((proj) => (
                    <div
                      key={proj._id}
                      onClick={() => router.push(`/projects/${proj._id}`)}
                      className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center space-x-3.5">
                        <div className="w-9 h-9 rounded-xl bg-accent-blue/10 flex items-center justify-center">
                          <FolderCode className="w-4 h-4 text-accent-blue" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-white">{proj.name}</span>
                          <span className="text-[10px] text-text-secondary mt-0.5 font-mono">
                            {proj.language || 'generic'} / {proj.framework || 'vanilla'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-text-secondary">Health</span>
                          <span className={`text-[10px] font-bold ${
                            proj.healthScore >= 90 ? 'text-success' : 'text-warning'
                          }`}>
                            {proj.healthScore}%
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-secondary" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-text-secondary flex flex-col items-center justify-center space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-accent-blue" />
                  </div>
                  <span>No projects uploaded yet. Sync your codebase ZIP files to start.</span>
                </div>
              )}
            </div>

            {/* AI Suggestions / Health warnings block */}
            <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass flex items-start space-x-4 border-l-accent-blue/80 border-l-4">
              <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5 text-accent-blue" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-xs text-white">AI Suggestion: Reusable System Detected</h4>
                <p className="text-[11px] text-text-secondary leading-relaxed mt-1">
                  We noticed you have built similar JWT login structures in 3 different files. Consider bundling this setup into a **Reusable System** schema to copy it quickly for future services.
                </p>
                <button
                  onClick={() => router.push('/chat')}
                  className="mt-3.5 px-3 py-1.5 bg-accent-blue/10 hover:bg-accent-blue/20 text-[10px] font-bold text-accent-blue rounded-xl transition-colors cursor-pointer"
                >
                  Generate Reusable System
                </button>
              </div>
            </div>
          </div>

          {/* Right Activities & Notifications feed (1/3 width) */}
          <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass space-y-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-5">
                <Activity className="w-4 h-4 text-accent-blue" />
                <h3 className="font-bold text-sm">Recent Sync Activities</h3>
              </div>

              <div className="space-y-4">
                {activities.length > 0 ? (
                  activities.map((act, i) => (
                    <div key={i} className="flex items-start space-x-3 text-xs">
                      <div className="w-2 h-2 rounded-full bg-accent-blue/60 mt-1.5 flex-shrink-0"></div>
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{act.action}</span>
                        <span className="text-[9px] text-text-secondary mt-0.5">{act.details} • {act.time}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-text-secondary block py-4 text-center">No recent sync activities. Upload a repository to start tracking.</span>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-card-border/60">
              <button
                onClick={() => router.push('/chat')}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-card-border text-center rounded-2xl text-xs font-semibold transition-colors cursor-pointer flex justify-center items-center"
              >
                Open AI Brain Chat
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>

        {/* Phase 3 Advanced AI Features row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {/* AI Standup Generator card */}
          <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass flex flex-col justify-between h-[300px]">
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Sparkles className="w-4 h-4 text-accent-blue" />
                <h3 className="font-bold text-sm">AI Daily Standup</h3>
              </div>
              <p className="text-[10px] text-text-secondary leading-relaxed">
                Generate a daily status report mapping your recent uploads, snippets created, and errors solved to export to Slack.
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
                    alert('Standup copied to clipboard!');
                  }}
                  className="w-full py-2.5 bg-success/20 hover:bg-success/30 text-success border border-success/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Copy Report
                </button>
              ) : (
                <button
                  onClick={handleGenerateStandup}
                  disabled={generatingStandup}
                  className="w-full py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  {generatingStandup ? 'Generating...' : 'Generate Standup'}
                </button>
              )}
            </div>
          </div>

          {/* Hidden Knowledge Finder card */}
          <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass flex flex-col justify-between h-[300px]">
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Brain className="w-4.5 h-4.5 text-accent-blue" />
                <h3 className="font-bold text-sm">Hidden Knowledge Finder</h3>
              </div>
              <p className="text-[10px] text-text-secondary leading-relaxed mb-4">
                AI scans your codes history to locate repeated logic structures or patterns that you forgot.
              </p>

              <div className="space-y-2.5">
                {hiddenKnowledge.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-white/5 border border-white/5 rounded-xl text-[10px]">
                    <span className="font-bold text-white block">{item.title}</span>
                    <span className="text-text-secondary block mt-0.5 leading-normal">{item.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Opportunity Engine card */}
          <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass flex flex-col justify-between h-[300px]">
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <TrendingUp className="w-4 h-4 text-accent-blue" />
                <h3 className="font-bold text-sm">Opportunity Engine</h3>
              </div>
              <p className="text-[10px] text-text-secondary leading-relaxed mb-4">
                AI analyzes your technology stack strengths and projects counts to suggest profitable SaaS template products.
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
              Export Boilerplate Kit
            </button>
          </div>
        </div>
      </main>

      <CommandPalette />
    </div>
  );
}
