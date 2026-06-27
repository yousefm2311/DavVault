'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { AppPageSkeleton, SectionSkeleton } from '@/components/LoadingStates';
import { useLanguage } from '@/context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import {
  Users,
  Plus,
  Mail,
  UserPlus,
  Shield,
  Trash2,
  Lock,
  Zap,
  CheckCircle2,
  Sparkles,
  Bot,
  Send,
  BookOpen,
  Terminal,
  Copy,
  Check,
  Cpu,
  ArrowRight,
  HardDrive
} from 'lucide-react';

interface BotMessage {
  bot: 'SecBot' | 'PerfBot' | 'DocBot';
  text: string;
}

interface Proposal {
  title: string;
  explanation: string;
  code: string;
}

export default function TeamBrainPage() {
  const { user, loading, apiFetch } = useAuth();
  const router = useRouter();
  const { t, dir } = useLanguage();
  const isRtl = dir === 'rtl';

  // Tabs: 'members' | 'discussion'
  const [activeTab, setActiveTab] = useState<'members' | 'discussion'>('members');

  // Database team members
  const [members, setMembers] = useState<any[]>([]);
  const [workspaceName, setWorkspaceName] = useState('');
  const [loadingTeam, setLoadingTeam] = useState(true);

  // Invite developer form state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Dynamic AI Agents roster
  const [aiAgents, setAiAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [inviteType, setInviteType] = useState<'human' | 'ai'>('human');

  // New AI Coworker Form State
  const [aiName, setAiName] = useState('');
  const [aiRole, setAiRole] = useState('');
  const [aiFocus, setAiFocus] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>('gemini');
  const [aiModelName, setAiModelName] = useState('gemini-1.5-flash');
  const [aiApiKey, setAiApiKey] = useState('');
  const [creatingAi, setCreatingAi] = useState(false);

  // AI Team simulation states
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [loadingSimulation, setLoadingSimulation] = useState(false);

  // Playback states
  const [playbackMessages, setPlaybackMessages] = useState<BotMessage[]>([]);
  const [activeBotTyping, setActiveBotTyping] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [copied, setCopied] = useState(false);

  const getAgentAvatar = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('sec')) return <Shield className="w-5 h-5 text-purple-400" />;
    if (n.includes('perf') || n.includes('speed') || n.includes('fast') || n.includes('opt')) return <Zap className="w-5 h-5 text-amber-400" />;
    if (n.includes('doc') || n.includes('write') || n.includes('read') || n.includes('spec')) return <BookOpen className="w-5 h-5 text-sky-400" />;
    return <Sparkles className="w-5 h-5 text-emerald-400" />;
  };


  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

  const fetchMembersAndProjects = async () => {
    try {
      const [membersData, projectsData, agentsData] = await Promise.all([
        apiFetch('/workspaces/members'),
        apiFetch('/projects'),
        apiFetch('/ai/agents'),
      ]);
      setWorkspaceName(membersData.workspace?.name || t('teamWorkspace'));
      setMembers(membersData.workspace?.members || []);
      setProjects(projectsData.projects || []);
      setAiAgents(agentsData.agents || []);
      if (projectsData.projects?.length > 0) {
        setSelectedProjectId(projectsData.projects[0]._id);
      }
    } catch (err) {
      console.error('[Team]: Fetch failed:', err);
    } finally {
      setLoadingTeam(false);
      setLoadingAgents(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchMembersAndProjects();
  }, [user]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const data = await apiFetch('/workspaces/members', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      setInviteSuccess(data.message || t('addMemberSuccess'));
      setInviteEmail('');
      setShowInvite(false);
      fetchMembersAndProjects();
    } catch (err: any) {
      setInviteError(err.message || t('addMemberFailed'));
    } finally {
      setInviting(false);
    }
  };

  const handleCreateAiAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiName || !aiRole || !aiFocus || !aiPrompt) return;

    setCreatingAi(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      await apiFetch('/ai/agents', {
        method: 'POST',
        body: JSON.stringify({
          name: aiName,
          role: aiRole,
          focus: aiFocus,
          systemPrompt: aiPrompt,
          modelProvider: aiProvider,
          modelName: aiModelName,
          apiKey: aiApiKey,
        }),
      });

      setInviteSuccess(isRtl ? 'تم إضافة الزميل الافتراضي بنجاح!' : 'AI Coworker created successfully!');
      setAiName('');
      setAiRole('');
      setAiFocus('');
      setAiPrompt('');
      setAiApiKey('');
      setAiProvider('gemini');
      setAiModelName('gemini-1.5-flash');
      setShowInvite(false);
      fetchMembersAndProjects();
    } catch (err: any) {
      setInviteError(err.message || 'Failed to create AI coworker.');
    } finally {
      setCreatingAi(false);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!window.confirm(isRtl ? 'هل أنت متأكد من حذف هذا الزميل الافتراضي؟' : 'Are you sure you want to delete this AI coworker?')) return;
    try {
      await apiFetch(`/ai/agents/${agentId}`, { method: 'DELETE' });
      fetchMembersAndProjects();
    } catch (err: any) {
      alert(err.message || 'Failed to delete AI coworker.');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!window.confirm(isRtl ? 'هل تريد إزالة هذا العضو؟' : 'Remove this workspace member?')) return;
    try {
      await apiFetch(`/workspaces/members/${userId}`, { method: 'DELETE' });
      setMembers((current) =>
        current.filter((member) => String(member.userId?._id || member.userId?.id) !== userId)
      );
    } catch (err: any) {
      setInviteError(err.message || t('addMemberFailed'));
    }
  };

  // Launch AI Agents Discussion simulation with typewriter playback
  const handleLaunchSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !taskInput.trim() || loadingSimulation || activeBotTyping) return;

    setLoadingSimulation(true);
    setPlaybackMessages([]);
    setProposal(null);

    try {
      const data = await apiFetch('/ai/team-simulation', {
        method: 'POST',
        body: JSON.stringify({
          projectId: selectedProjectId,
          task: taskInput,
        }),
      });

      setLoadingSimulation(false);

      // Playback simulation loop
      let currentIdx = 0;
      const playNextMessage = () => {
        if (currentIdx < data.discussion.length) {
          const nextMsg = data.discussion[currentIdx];
          setActiveBotTyping(nextMsg.bot);

          setTimeout(() => {
            setPlaybackMessages(prev => [...prev, nextMsg]);
            setActiveBotTyping(null);
            currentIdx++;
            setTimeout(playNextMessage, 600); // 600ms gap between typings
          }, 1800); // 1.8s typing simulation
        } else {
          setProposal(data.proposal);
        }
      };

      playNextMessage();
    } catch (err) {
      console.error('[Team/Simulation]: Discussion failed:', err);
      setLoadingSimulation(false);
      alert(isRtl ? 'حدث خطأ أثناء إجراء المحاكاة.' : 'Failed to execute AI simulation.');
    }
  };

  const handleCopyPatch = () => {
    if (!proposal?.code) return;
    navigator.clipboard.writeText(proposal.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading || !user) return <AppPageSkeleton label={t('loadingTeamBrain')} />;

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none" dir={dir}>
      <Sidebar />

      <motion.main
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex-1 p-5 lg:p-10 overflow-y-auto max-w-6xl mx-auto flex flex-col pb-28"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4 border-b border-card-border pb-5">
          <div>
            <div className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-accent-blue/20 bg-accent-blue/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-accent-blue">
              <Cpu className="h-3.5 w-3.5" />
              DevVault Agents
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{t('teamBrainTitle')}</h2>
            <p className="text-xs text-text-secondary mt-1">
              {t('teamBrainSubtitle')}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowInvite(!showInvite)}
              className="flex items-center px-4 py-2.5 bg-white/5 border border-card-border hover:bg-white/10 text-xs font-semibold rounded-2xl transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4 ml-1.5 ltr:mr-1.5 ltr:ml-0 text-text-secondary" />
              {t('inviteMember')}
            </button>
          </div>
        </div>

        {/* Invite panel */}
        {showInvite && (
          <div className="mb-6 bg-card-bg/60 border border-card-border p-6 rounded-[28px] glass">
            {/* Invite Type Switcher */}
            <div className="flex gap-2 mb-5 border-b border-card-border pb-4">
              <button
                type="button"
                onClick={() => setInviteType('human')}
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  inviteType === 'human' ? 'bg-white/10 text-white border border-white/10' : 'text-text-secondary hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 inline ml-1.5 ltr:mr-1.5 ltr:ml-0" />
                {isRtl ? 'دعوة مطور حقيقي' : 'Invite Real Developer'}
              </button>
              <button
                type="button"
                onClick={() => setInviteType('ai')}
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  inviteType === 'ai' ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/20' : 'text-text-secondary hover:text-white'
                }`}
              >
                <Bot className="w-3.5 h-3.5 inline ml-1.5 ltr:mr-1.5 ltr:ml-0" />
                {isRtl ? 'إنشاء زميل ذكاء اصطناعي' : 'Create AI Coworker'}
              </button>
            </div>

            <h3 className="font-bold text-sm mb-4">
              {inviteType === 'human'
                ? (isRtl ? 'دعوة مطور جديد لمساحة العمل' : 'Invite Developer to Workspace')
                : (isRtl ? 'تخصيص وإنشاء زميل افتراضي ذكي' : 'Customize & Spawn AI Coworker')}
            </h3>

            {inviteError && (
              <div className="mb-4 p-3 bg-danger/10 border border-danger/25 text-danger rounded-xl text-xs font-medium">
                {inviteError}
              </div>
            )}
            {inviteSuccess && (
              <div className="mb-4 p-3 bg-success/10 border border-success/25 text-success rounded-xl text-xs font-medium flex items-center">
                <CheckCircle2 className="w-4 h-4 ml-2 animate-bounce" />
                <span className="mr-2 ltr:ml-2 ltr:mr-0">{inviteSuccess}</span>
              </div>
            )}

            {inviteType === 'human' ? (
              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('userEmail')}</label>
                    <div className="relative mt-1">
                      <Mail className="absolute right-4 ltr:left-4 ltr:right-auto top-3.5 w-4 h-4 text-text-secondary" />
                      <input
                        type="email"
                        placeholder="teammate@company.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        disabled={inviting}
                        className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 pr-11 pl-4 ltr:pl-11 ltr:pr-4 text-xs text-white outline-none focus:border-accent-blue/50"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('memberRole')}</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
                      disabled={inviting}
                      className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3.5 px-4 text-xs text-white outline-none focus:border-accent-blue/50 mt-1"
                    >
                      <option value="member">{t('roleMemberDesc')}</option>
                      <option value="admin">{t('roleAdminDesc')}</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInvite(false)}
                    disabled={inviting}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-semibold cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={inviting || !inviteEmail}
                    className="px-5 py-2.5 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-accent-blue/50 text-white rounded-2xl text-xs font-semibold cursor-pointer"
                  >
                    {inviting ? t('addingMember') : t('addTeamMember')}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateAiAgent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                      {isRtl ? 'اسم الزميل الافتراضي' : 'AI Coworker Name'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CleanBot"
                      value={aiName}
                      onChange={(e) => setAiName(e.target.value)}
                      className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50 mt-1"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                      {isRtl ? 'الدور الوظيفي' : 'AI Teammate Role'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Code Reviewer"
                      value={aiRole}
                      onChange={(e) => setAiRole(e.target.value)}
                      className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50 mt-1"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                      {isRtl ? 'محرك الذكاء وموديل التشغيل' : 'LLM Engine Model'}
                    </label>
                    <select
                      value={`${aiProvider}/${aiModelName}`}
                      onChange={(e) => {
                        const [prov, mod] = e.target.value.split('/');
                        setAiProvider(prov as 'gemini' | 'openai');
                        setAiModelName(mod);
                      }}
                      className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3.5 px-4 text-xs text-white outline-none focus:border-accent-blue/50 mt-1"
                    >
                      <option value="gemini/gemini-1.5-flash">Gemini 1.5 Flash</option>
                      <option value="gemini/gemini-1.5-pro">Gemini 1.5 Pro</option>
                      <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                      <option value="openai/gpt-4o">GPT-4o</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                    {isRtl ? 'مفتاح الـ API الخاص بالموديل (اختياري - لتشغيل الموديل بحسابك الخاص)' : 'Model API Key (Optional - to run using your own API account)'}
                  </label>
                  <input
                    type="password"
                    placeholder={aiProvider === 'gemini' ? (isRtl ? 'أدخل مفتاح Gemini (يبدأ بـ AIzaSy)...' : 'Enter Gemini key (starts with AIzaSy)...') : (isRtl ? 'أدخل مفتاح OpenAI (يبدأ بـ sk-)...' : 'Enter OpenAI key (starts with sk-)...')}
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50 mt-1 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                    {isRtl ? 'مجال التركيز' : 'Focus Area'}
                  </label>
                  <input
                    type="text"
                    placeholder={isRtl ? 'مثال: جودة الكود، التوثيق البرمجي، التحقق من المدخلات' : 'e.g. Code readability, DRY principles, type safety'}
                    value={aiFocus}
                    onChange={(e) => setAiFocus(e.target.value)}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50 mt-1"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                    {isRtl ? 'التعليمات والتوجيهات (System Prompt)' : 'System Instructions (Prompt)'}
                  </label>
                  <textarea
                    placeholder={isRtl ? 'اكتب التوجيهات التي تحدد سلوك البوت وكيفية مراجعته للكود...' : 'Define how the bot behaves, what patterns it flags, and how it responds...'}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50 h-20 resize-none mt-1"
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInvite(false)}
                    disabled={creatingAi}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-semibold cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={creatingAi || !aiName || !aiRole || !aiFocus || !aiPrompt}
                    className="px-5 py-2.5 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-accent-blue/50 text-white rounded-2xl text-xs font-semibold cursor-pointer"
                  >
                    {creatingAi ? (isRtl ? 'جاري الإنشاء...' : 'Creating...') : (isRtl ? 'إنشاء الزميل الافتراضي' : 'Create AI Coworker')}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tab Selection */}
        <div className="mb-6 flex gap-1.5 max-w-sm rounded-xl border border-card-border/60 bg-bg-secondary p-1">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'members' ? 'bg-accent-blue text-white' : 'text-text-secondary hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 inline ltr:mr-1.5 rtl:ml-1.5" />
            {isRtl ? 'أعضاء فريق العمل' : 'Workspace Members'}
          </button>
          <button
            onClick={() => setActiveTab('discussion')}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'discussion' ? 'bg-accent-blue text-white' : 'text-text-secondary hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5 inline ltr:mr-1.5 rtl:ml-1.5" />
            {isRtl ? 'نقاش الزملاء الافتراضيين' : 'AI Agent Discussion'}
          </button>
        </div>

        {/* 1. TAB Members (Human + AI Hybrid list) */}
        {activeTab === 'members' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass">
              <div className="flex items-center gap-2.5 mb-6">
                <Users className="w-5 h-5 text-accent-blue" />
                <h3 className="font-bold text-sm text-white">
                  {isRtl ? 'قائمة أعضاء الفريق والهجناء' : 'Human & AI Team List'} (
                  <AnimatedCounter value={members.length + aiAgents.length} />)
                </h3>
              </div>

              {loadingTeam || loadingAgents ? (
                <SectionSkeleton rows={4} className="border-0 bg-transparent p-0" />
              ) : (
                <div className="space-y-4">
                  {/* Virtual AI Agents Rendered at the top of Team list */}
                  {aiAgents.map((bot, i) => (
                    <div
                      key={`bot-${i}`}
                      className="flex items-start md:items-center justify-between p-4 bg-accent-blue/[0.03] border border-accent-blue/15 rounded-2xl hover:bg-accent-blue/[0.06] transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-accent-blue/15 border border-accent-blue/20 flex items-center justify-center">
                          {getAgentAvatar(bot.name)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{bot.name}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 border text-[8px] font-bold rounded-full uppercase tracking-wider ${
                              bot.isSystem
                                ? 'bg-gradient-to-r from-purple-500/20 to-accent-blue/20 border-accent-blue/30 text-accent-blue'
                                : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                            }`}>
                              {bot.isSystem ? 'AI BOT' : 'CUSTOM AI'}
                            </span>
                          </div>
                          <span className="text-[10px] text-text-secondary mt-0.5 font-mono">{bot.email}</span>
                          {!bot.isSystem && (
                            <span className="text-[9px] text-text-muted mt-0.5 font-mono flex flex-wrap items-center gap-1.5">
                              <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded-md text-[8px]">
                                {bot.modelProvider.toUpperCase()}: {bot.modelName}
                              </span>
                              {bot.apiKey ? (
                                <span className="text-emerald-400 text-[8px] font-bold">
                                  {isRtl ? '🔑 تم ضبط المفتاح الخاص' : '🔑 Custom Key Active'}
                                </span>
                              ) : (
                                <span className="text-text-muted text-[8px]">
                                  {isRtl ? '🔑 يستخدم المفتاح العام' : '🔑 Global Key Active'}
                                </span>
                              )}
                            </span>
                          )}
                          <span className="text-[9px] text-text-muted mt-1 leading-relaxed hidden md:block">
                            {isRtl ? 'التركيز:' : 'Focus:'} {bot.focus}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="inline-flex items-center px-2 py-0.5 bg-accent-blue/10 border border-accent-blue/15 text-[9px] font-mono font-bold text-accent-blue rounded-full uppercase">
                          {bot.role}
                        </span>
                        {!bot.isSystem && (
                          <button
                            onClick={() => handleDeleteAgent(bot._id)}
                            className="p-1.5 hover:bg-danger/10 hover:text-danger rounded-lg text-text-secondary transition-colors cursor-pointer"
                            title={isRtl ? 'حذف الزميل الافتراضي' : 'Delete AI Coworker'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Real Humans */}
                  {members.map((member, i) => {
                    const u = member.userId;
                    const isOwner = member.role === 'owner';
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <img
                            src={u.avatar || 'https://lh3.googleusercontent.com/a/default-user'}
                            alt={u.name}
                            className="w-10 h-10 rounded-full border border-card-border object-cover"
                          />
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-white">{u.name}</span>
                            <span className="text-[10px] text-text-secondary mt-0.5 font-mono">{u.email}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 bg-card-bg border border-card-border text-[9px] font-mono font-bold text-text-secondary rounded-full uppercase">
                            {member.role}
                          </span>
                          {!isOwner && (
                            <button
                              onClick={() => handleRemoveMember(String(u._id || u.id))}
                              className="p-1.5 hover:bg-danger/10 hover:text-danger rounded-lg text-text-secondary transition-colors cursor-pointer"
                              title={t('removeMember')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Permissions cards */}
            <div className="space-y-6">
              <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass space-y-4">
                <h3 className="font-bold text-sm text-white flex items-center">
                  <Lock className="w-4 h-4 text-warning ltr:mr-2 rtl:ml-2" />
                  {t('workspacePermissions')}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {t('rbacNotice')}
                </p>
                <div className="p-3.5 bg-white/5 border border-white/5 rounded-xl flex items-start gap-3">
                  <Zap className="w-4 h-4 text-accent-blue mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-text-secondary leading-relaxed font-medium">
                    {t('knowledgeLock')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. TAB AI Agent Discussion Room (Interactive Simulation Workspace) */}
        {activeTab === 'discussion' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Column: Active Bots list */}
            <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass space-y-4">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Bot className="w-4 h-4 text-accent-blue" />
                {isRtl ? 'فريق العملاء النشط' : 'Active Agents Squad'}
              </h3>
              <p className="text-[10px] text-text-secondary leading-relaxed">
                {isRtl 
                  ? 'هؤلاء الزملاء الافتراضيون سيقومون بقراءة كود مشروعك ومناقشة المهمة المعطاة لهم والوصول معاً لأفضل حل برمجي.'
                  : 'These virtual agents will read your scoped files, debate security/efficiency, and draft a consensus proposal.'}
              </p>

              <div className="space-y-3.5 pt-2">
                {aiAgents.map((bot, i) => {
                  const isTyping = activeBotTyping === bot.name;
                  return (
                    <div
                      key={`active-${i}`}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isTyping ? 'border-accent-blue bg-accent-blue/5 shadow-md shadow-accent-blue/5' : 'border-white/5 bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getAgentAvatar(bot.name)}
                          <span className="text-xs font-bold text-white">{bot.name}</span>
                        </div>
                        <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          isTyping ? 'bg-accent-blue text-white animate-pulse' : 'bg-white/5 text-text-secondary'
                        }`}>
                          {isTyping ? (isRtl ? 'يكتب...' : 'Typing...') : (isRtl ? 'خامل' : 'Idle')}
                        </span>
                      </div>
                      <p className="text-[9px] text-text-secondary leading-relaxed mt-2">
                        {bot.focus}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right/Center Column: Discussion Console and Results */}
            <div className="lg:col-span-2 space-y-6">
              {/* Task Input Form */}
              <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass">
                <h3 className="font-bold text-sm text-white mb-3">
                  {isRtl ? 'تكليف فريق الذكاء الاصطناعي بمهمة' : 'Assign Task to AI Squad'}
                </h3>
                <form onSubmit={handleLaunchSimulation} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                        {isRtl ? 'المشروع البرمجي المستهدف' : 'Target Project Scope'}
                      </label>
                      <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        disabled={loadingSimulation || !!activeBotTyping}
                        className="w-full bg-bg-primary/50 border border-card-border rounded-xl py-3 px-3 text-xs text-white outline-none focus:border-accent-blue/50 mt-1"
                        required
                      >
                        {projects.length > 0 ? (
                          projects.map(p => (
                            <option key={p._id} value={p._id}>{p.name}</option>
                          ))
                        ) : (
                          <option value="">{isRtl ? 'لا توجد مشاريع مرفوعة' : 'No uploaded projects'}</option>
                        )}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                        {isRtl ? 'سرعة المعالجة' : 'Simulation Engine'}
                      </label>
                      <div className="flex items-center gap-1.5 text-xs text-text-secondary bg-bg-primary/30 border border-card-border rounded-xl px-3 py-3 mt-1 font-mono font-bold">
                        <Sparkles className="w-3.5 h-3.5 text-accent-blue" />
                        <span>DevVault V2 Agent</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                      {isRtl ? 'وصف المهمة أو المشكلة البرمجية' : 'Task or Debugging Request'}
                    </label>
                    <textarea
                      value={taskInput}
                      onChange={(e) => setTaskInput(e.target.value)}
                      disabled={loadingSimulation || !!activeBotTyping}
                      placeholder={isRtl ? 'مثال: قم بمراجعة عملية استخراج الملفات وتحسين الأداء، أو افحص الكود ضد الثغرات...' : 'Example: Audit connection logic for memory leaks, or verify authentication security validation...'}
                      className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50 h-20 resize-none mt-1"
                      required
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={loadingSimulation || !taskInput.trim() || !selectedProjectId || !!activeBotTyping}
                      className="flex items-center gap-2 px-5 py-3 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-accent-blue/50 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-accent-blue/15 cursor-pointer"
                    >
                      {loadingSimulation ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>{isRtl ? 'جاري تحليل الملفات...' : 'Analyzing codebase...'}</span>
                        </>
                      ) : activeBotTyping ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>{isRtl ? 'يجري النقاش حالياً...' : 'Discussing...'}</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>{isRtl ? 'بدء نقاش الفريق' : 'Launch AI Discussion'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Discussion terminal console */}
              {(playbackMessages.length > 0 || activeBotTyping) && (
                <div className="rounded-[28px] border border-card-border/80 bg-[#0B0F19] p-6 shadow-xl relative overflow-hidden select-text">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-accent-blue to-sky-500 animate-pulse"></div>
                  
                  {/* Console Header */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-5 text-[10px] text-text-secondary font-mono">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-accent-blue" />
                      <span>COWORKER_WORKSPACE_DISCUSSION_LOG</span>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-danger/60"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-warning/60"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-success/60"></span>
                    </div>
                  </div>

                  {/* Playback list */}
                  <div className="space-y-5 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                    {playbackMessages.map((msg, index) => {
                      const botInfo = aiAgents.find(b => b.name === msg.bot);
                      return (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4 }}
                          className="flex gap-3 items-start"
                        >
                          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                            {getAgentAvatar(msg.bot)}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-white">{msg.bot}</span>
                              <span className="text-[8px] text-text-muted font-mono">({botInfo?.role || 'AI Coworker'})</span>
                            </div>
                            <p className="text-xs leading-relaxed text-[#D1D5DB] bg-white/[0.02] border border-white/5 rounded-2xl p-3">
                              {msg.text}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}

                    {/* Active typing bot */}
                    {activeBotTyping && (
                      <div className="flex gap-3 items-start animate-pulse">
                        <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                          {getAgentAvatar(activeBotTyping)}
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold text-white">{activeBotTyping} is writing...</span>
                          <div className="p-3 bg-white/5 border border-white/5 rounded-2xl flex items-center space-x-1.5 py-2.5">
                            <div className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Proposal optimal code card */}
              {proposal && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="bg-card-bg/40 border border-accent-blue/30 p-6 rounded-[28px] glass space-y-4 select-text relative"
                >
                  <div className="flex items-start justify-between border-b border-card-border pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-accent-blue/15 flex items-center justify-center border border-accent-blue/20">
                        <Sparkles className="w-4 h-4 text-accent-blue" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">{isRtl ? 'الرأي النهائي المتفق عليه' : 'Consensus Team Proposal'}</h4>
                        <h3 className="text-sm font-bold text-accent-blue mt-0.5">{proposal.title}</h3>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleCopyPatch}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-text-secondary hover:text-white transition-all cursor-pointer border border-card-border"
                      title={isRtl ? 'نسخ الرقعة البرمجية' : 'Copy Solution Code'}
                    >
                      {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <p className="text-xs leading-relaxed text-text-secondary">
                    {proposal.explanation}
                  </p>

                  <div className="relative rounded-2xl bg-[#090D16] border border-card-border p-4 overflow-x-auto font-mono text-[10px] text-emerald-400 select-text">
                    <pre className="whitespace-pre">{proposal.code}</pre>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => {
                        const askPrompt = isRtl
                          ? `ما هي مقترحات التحسين البرمجي لمشروعنا بخصوص: ${taskInput}؟`
                          : `What are the optimization proposals for our project regarding: ${taskInput}?`;
                        router.push(`/chat?projectId=${selectedProjectId}&ask=${encodeURIComponent(askPrompt)}`);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-md shadow-accent-blue/10"
                    >
                      {isRtl ? 'متابعة النقاش في شات الذكاء' : 'Continue in AI Chat'}
                      <ArrowRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </motion.main>

      <CommandPalette />
    </div>
  );
}
