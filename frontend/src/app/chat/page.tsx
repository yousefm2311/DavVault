'use client';

import React, { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { AppPageSkeleton } from '@/components/LoadingStates';
import Editor from '@monaco-editor/react';
import {
  MessageSquare,
  Sparkles,
  Send,
  FileCode,
  Sparkle,
  Plus,
  X,
  Copy,
  Check,
  ArrowRight,
  Trash2,
  Menu,
  Search,
  BookOpen,
  FolderCode,
  HardDrive,
  Shield,
  Zap,
  Bot
} from 'lucide-react';

interface Citation {
  fileName: string;
  path: string;
  code?: string;
  score?: number;
}

interface Message {
  sender: 'user' | 'assistant';
  senderName?: string;
  text: string;
  citations?: Citation[];
  createdAt: Date;
  isLimit?: boolean;
}

interface SourceFile {
  _id: string;
  fileName: string;
  path: string;
  language?: string;
  summary?: string;
}

function AIChatPageContent() {
  const { user, loading, apiFetch } = useAuth();
  const { t, dir } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Data states
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // AI Coworkers states
  const [aiAgents, setAiAgents] = useState<any[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);

  // Input states
  const [inputMsg, setInputMsg] = useState('');
  const [sending, setSending] = useState(false);

  // Search filter for files
  const [fileSearch, setFileSearch] = useState('');

  // Monaco code viewer split panel
  const [drawerCode, setDrawerCode] = useState<string | null>(null);
  const [drawerTitle, setDrawerTitle] = useState('');
  const [drawerLanguage, setDrawerLanguage] = useState('javascript');
  const [copied, setCopied] = useState(false);

  // Collapsible panels states (Desktop & Mobile)
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isRtl = dir === 'rtl';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

  const loadInitialData = async () => {
    try {
      const [projectsData, sessionsData, agentsData] = await Promise.all([
        apiFetch('/projects'),
        apiFetch('/ai/sessions'),
        apiFetch('/ai/agents'),
      ]);

      setProjects(projectsData.projects || []);
      setSessions(sessionsData.sessions || []);
      setAiAgents(agentsData.agents || []);
    } catch (err) {
      console.error('[Chat]: Initial loading failed:', err);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadInitialData();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const urlProjectId = searchParams.get('projectId');
    if (urlProjectId) setSelectedProjectId(urlProjectId);

    const urlAsk = searchParams.get('ask');
    if (urlAsk) {
      setInputMsg(decodeURIComponent(urlAsk));
    }
  }, [user, searchParams]);

  useEffect(() => {
    if (!user || !selectedProjectId) {
      setSourceFiles([]);
      return;
    }

    const loadSourceFiles = async () => {
      try {
        const data = await apiFetch(`/projects/${selectedProjectId}/files`);
        setSourceFiles(data.files || []);
      } catch (err) {
        console.error('[Chat]: Failed to load source files:', err);
        setSourceFiles([]);
      }
    };

    loadSourceFiles();
  }, [user, selectedProjectId]);

  useEffect(() => {
    if (activeSessionId) {
      setActiveSessionId(null);
      setMessages([]);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchSessionMessages = async (id: string) => {
    try {
      const data = await apiFetch(`/ai/sessions/${id}`);
      setMessages(data.session?.messages || []);
      setActiveSessionId(id);
    } catch (err) {
      console.error('[Chat]: Failed to load messages:', err);
    }
  };

  const handleStartNewSession = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInputMsg('');
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(isRtl ? 'هل أنت متأكد من حذف هذه المحادثة؟' : 'Delete this chat session permanently?')) {
      return;
    }

    try {
      await apiFetch(`/ai/sessions/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s._id !== id));
      if (activeSessionId === id) {
        handleStartNewSession();
      }
    } catch (err) {
      console.error('[Chat]: Failed to delete session:', err);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault();
    const queryText = customMsg || inputMsg;
    if (!queryText.trim() || sending) return;

    setInputMsg('');
    setSending(true);

    const userMsg: Message = { sender: 'user', text: queryText, createdAt: new Date() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const data = await apiFetch('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: queryText,
          sessionId: activeSessionId || undefined,
          projectId: selectedProjectId || undefined,
          selectedAgents: selectedAgentIds.length > 0 ? selectedAgentIds : undefined,
        }),
      });

      if (data.answers && Array.isArray(data.answers)) {
        // Playback/sequential append of multiple agent responses
        let currentIdx = 0;
        const addNextBotReply = () => {
          if (currentIdx < data.answers.length) {
            const reply = data.answers[currentIdx];
            const botMsg: Message = {
              sender: 'assistant',
              senderName: reply.senderName,
              text: reply.text,
              citations: data.citations || [],
              createdAt: new Date(),
            };
            setMessages(prev => [...prev, botMsg]);
            currentIdx++;
            setTimeout(addNextBotReply, 700); // 700ms gap between each bot reply appearing
          }
        };
        addNextBotReply();
      } else {
        const assistantMsg: Message = {
          sender: 'assistant',
          senderName: undefined,
          text: data.answer,
          citations: data.citations || [],
          createdAt: new Date(),
        };
        setMessages(prev => [...prev, assistantMsg]);
      }

      if (!activeSessionId) {
        setActiveSessionId(data.sessionId);
        const sessionsData = await apiFetch('/ai/sessions');
        setSessions(sessionsData.sessions || []);
      }
    } catch (err: any) {
      console.error('[Chat]: Message dispatch failed:', err);
      const isLimitExceeded = err.message?.toLowerCase().includes('limit');
      const errorMsg: Message = {
        sender: 'assistant',
        text: isLimitExceeded
          ? t('reachedRagLimit')
          : t('chatErrorOccurred'),
        createdAt: new Date(),
        isLimit: isLimitExceeded,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleOpenCitation = (cit: Citation) => {
    if (cit.code) {
      setDrawerCode(cit.code);
      setDrawerTitle(cit.fileName);
      const ext = cit.path.split('.').pop() || 'js';
      setDrawerLanguage(ext === 'dart' ? 'dart' : ext === 'py' ? 'python' : 'javascript');
      setRightPanelOpen(true); // Auto expand right panel
    }
  };

  const handleCopyCode = () => {
    if (!drawerCode) return;
    navigator.clipboard.writeText(drawerCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const getAgentAvatarAndStyles = (name?: string) => {
    if (!name) {
      return {
        avatar: <Sparkles className="w-3.5 h-3.5" />,
        styles: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
        displayName: t('aiAssistant')
      };
    }

    const n = name.toLowerCase();
    if (n.includes('sec')) {
      return {
        avatar: <Shield className="w-3.5 h-3.5" />,
        styles: 'bg-purple-500/10 text-purple-400 ring-purple-500/20',
        displayName: name
      };
    }
    if (n.includes('perf') || n.includes('speed') || n.includes('fast') || n.includes('opt')) {
      return {
        avatar: <Zap className="w-3.5 h-3.5 animate-pulse" />,
        styles: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
        displayName: name
      };
    }
    if (n.includes('doc') || n.includes('write') || n.includes('read') || n.includes('spec')) {
      return {
        avatar: <BookOpen className="w-3.5 h-3.5" />,
        styles: 'bg-sky-500/10 text-sky-400 ring-sky-500/20',
        displayName: name
      };
    }

    // Default custom agent
    return {
      avatar: <Bot className="w-3.5 h-3.5" />,
      styles: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
      displayName: name
    };
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    if (user.name) {
      return user.name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
    }
    return user.email ? user.email[0].toUpperCase() : 'U';
  };

  const activeSessionTitle = useMemo(() => {
    if (!activeSessionId) return t('newChat');
    const active = sessions.find(s => s._id === activeSessionId);
    return active ? active.title : t('aiAssistant');
  }, [activeSessionId, sessions]);

  const filteredSourceFiles = useMemo(() => {
    if (!fileSearch.trim()) return sourceFiles;
    const query = fileSearch.toLowerCase();
    return sourceFiles.filter(f => f.path.toLowerCase().includes(query) || f.fileName.toLowerCase().includes(query));
  }, [fileSearch, sourceFiles]);

  const quickPrompts = [
    {
      title: isRtl ? 'شرح معمارية المشروع' : 'Explain Architecture',
      desc: isRtl ? 'افهم هيكلية المشروع ومسؤولية المجلدات الكبرى' : 'Understand folder structure and key systems',
      prompt: isRtl 
        ? 'اشرح لي معمارية هذا المشروع وهيكل الملفات البرمجية والمسؤولية لكل مجلد أساسي.'
        : 'Explain the architecture of this project, its folder structure, and the responsibility of each main directory.'
    },
    {
      title: isRtl ? 'فحص الثغرات الأمنية' : 'Scan for Secrets',
      desc: isRtl ? 'ابحث عن أي كلمات مرور مسربة أو عيوب حماية' : 'Search for credential leaks or bugs',
      prompt: isRtl
        ? 'هل يحتوي المشروع على أي ثغرات أمنية واضحة أو كلمات مرور مسربة أو ممارسات غير آمنة؟'
        : 'Are there any obvious security vulnerabilities, leaked secrets, or unsafe coding practices in this project?'
    },
    {
      title: isRtl ? 'كتابة اختبارات الوحدة' : 'Write Unit Tests',
      desc: isRtl ? 'توليد ملفات اختبار برمجي لكود المشروع' : 'Generate automated testing files',
      prompt: isRtl
        ? 'اختر أحد الملفات المهمة في المشروع واكتب له اختبارات وحدة (Unit Tests) شاملة.'
        : 'Select an important file in the project and write comprehensive unit tests for it.'
    },
    {
      title: isRtl ? 'تحسين كفاءة الكود' : 'Optimize Code',
      desc: isRtl ? 'اقتراح تحسينات للسرعة وجودة الكود' : 'Suggest speed and clarity improvements',
      prompt: isRtl
        ? 'اقترح عليّ تحسينات لكفاءة الأداء وجودة الكود وتنظيف التكرارات في هذا المشروع.'
        : 'Suggest performance optimizations, clean code improvements, and how to refactor duplicates in this project.'
    }
  ];

  if (loading || !user) return <AppPageSkeleton label={t('loadingChatSpace')} />;

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none" dir={dir}>
      <Sidebar />

      <main className="flex-1 flex overflow-hidden h-screen relative">
        {/* 1. Collapsible Workspace & Files Panel */}
        <div className={`
          absolute lg:static top-0 bottom-0 z-40 bg-bg-secondary/95 backdrop-blur-xl flex flex-col justify-between select-none transition-all duration-300
          ${isRtl ? 'border-l left-0 right-auto' : 'border-r right-0 left-auto'}
          ${leftPanelOpen ? 'w-80 translate-x-0' : 'w-0 overflow-hidden -translate-x-full lg:translate-x-0 lg:w-0 lg:border-r-0'}
        `}>
          <div className="flex-1 flex flex-col min-h-0 p-5 space-y-5 w-80">
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderCode className="w-4 h-4 text-accent-blue" />
                {isRtl ? 'سياق العمل والملفات' : 'Workspace & Files'}
              </h3>
              <button 
                onClick={() => setLeftPanelOpen(false)}
                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-text-secondary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleStartNewSession}
              className="w-full flex items-center justify-center py-3 bg-accent-blue/10 border border-accent-blue/20 hover:bg-accent-blue/20 text-accent-blue rounded-[18px] text-xs font-bold transition-all cursor-pointer shadow-lg shadow-accent-blue/5"
            >
              <Plus className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
              {t('newChat')}
            </button>

            {/* Scope selection */}
            <div className="space-y-2">
              <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold px-1">
                {t('projectScope')}
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-bg-primary/50 border border-card-border/80 focus:border-accent-blue/40 rounded-xl py-2.5 px-3 text-xs text-white outline-none transition-all"
              >
                <option value="">{t('searchAllRepos')}</option>
                {projects.map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* AI Agents Group Selector */}
            <div className="space-y-2">
              <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold px-1 flex items-center justify-between">
                <span>{isRtl ? 'فريق نقاش الذكاء الاصطناعي' : 'AI Discussion Squad'}</span>
                {selectedAgentIds.length > 0 && (
                  <button
                    onClick={() => setSelectedAgentIds([])}
                    className="text-[8px] text-text-muted hover:text-white uppercase transition-colors cursor-pointer"
                  >
                    {isRtl ? 'إلغاء التحديد' : 'Clear'}
                  </button>
                )}
              </label>

              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {aiAgents.map((agent) => {
                  const id = agent._id || agent.name;
                  const isSelected = selectedAgentIds.includes(id);
                  return (
                    <div
                      key={id}
                      onClick={() => {
                        setSelectedAgentIds(prev =>
                          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                        );
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl border text-[10px] cursor-pointer transition-all ${
                        isSelected
                          ? 'border-accent-blue bg-accent-blue/10 text-white'
                          : 'border-card-border/50 bg-bg-primary/20 text-text-secondary hover:bg-bg-primary/40 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getAgentAvatarAndStyles(agent.name).avatar}
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold truncate">{agent.name}</span>
                          <span className="text-[8px] text-text-muted truncate">{agent.role}</span>
                        </div>
                      </div>
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                        isSelected ? 'bg-accent-blue border-accent-blue text-white' : 'border-card-border/80'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Source files list */}
            <div className="flex-1 flex flex-col min-h-0 space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                  {t('loadedSources')}
                </span>
                <span className="text-[10px] text-text-muted font-mono font-bold">
                  {filteredSourceFiles.length}
                </span>
              </div>
              
              {selectedProjectId && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder={isRtl ? 'ابحث في ملفات المشروع...' : 'Search files...'}
                    value={fileSearch}
                    onChange={(e) => setFileSearch(e.target.value)}
                    className="w-full bg-bg-primary/30 border border-card-border/60 focus:border-accent-blue/30 rounded-lg pl-8 pr-3 py-1.5 text-[10px] text-white outline-none transition-all font-mono"
                  />
                  <Search className="absolute left-2.5 top-2.5 w-3 h-3 text-text-muted" />
                </div>
              )}

              <div className="flex-1 overflow-y-auto rounded-2xl border border-card-border/60 bg-bg-primary/20 p-2 space-y-1 custom-scrollbar">
                {sourceFiles.length > 0 ? (
                  filteredSourceFiles.length > 0 ? (
                    filteredSourceFiles.map((file) => (
                      <button
                        key={file._id}
                        onClick={() => {
                          setDrawerTitle(file.fileName);
                          setDrawerCode(file.summary || t('openSourceDetails', { path: file.path }));
                          setDrawerLanguage('markdown');
                          setRightPanelOpen(true);
                        }}
                        className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 ${isRtl ? 'text-right' : 'text-left'} text-[10px] text-text-secondary transition hover:bg-white/5 hover:text-white font-mono`}
                      >
                        <FileCode className="h-3.5 w-3.5 shrink-0 text-accent-blue/70" />
                        <span className="min-w-0 flex-1 truncate">{file.path}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-2 py-8 text-center text-[10px] text-text-muted">
                      {isRtl ? 'لا توجد ملفات تطابق البحث' : 'No files matching search'}
                    </div>
                  )
                ) : (
                  <div className="px-3 py-10 text-center text-[10px] leading-relaxed text-text-muted">
                    {t('chooseProjectToLoadFiles')}
                  </div>
                )}
              </div>
            </div>

            {/* Recent chats */}
            <div className="space-y-2 pt-2 border-t border-card-border/40">
              <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold px-1 block">
                {t('recentChats')}
              </span>
              <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                {sessions.length > 0 ? (
                  sessions.map((s) => (
                    <div
                      key={s._id}
                      onClick={() => fetchSessionMessages(s._id)}
                      className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                        activeSessionId === s._id 
                          ? 'bg-accent-blue text-white shadow-md shadow-accent-blue/10' 
                          : 'text-text-secondary hover:bg-card-bg/40 hover:text-white'
                      }`}
                    >
                      <span className="truncate flex-1 font-medium">{s.title}</span>
                      <button
                        onClick={(e) => handleDeleteSession(e, s._id)}
                        className={`p-1 rounded-md text-text-muted hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-all ${
                          activeSessionId === s._id ? 'text-white/60 hover:text-white' : ''
                        }`}
                        title={isRtl ? 'حذف المحادثة' : 'Delete chat'}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-text-secondary/40 px-1 py-4">{t('noRecentChats')}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile backdrop for left sidebar */}
        {leftPanelOpen && (
          <div 
            onClick={() => setLeftPanelOpen(false)} 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          />
        )}

        {/* 2. Middle Panel: Spacious Chat Window Canvas */}
        <div className="flex-1 flex flex-col justify-between bg-bg-primary h-full relative min-w-0">
          {/* Header controls for collapsing and details */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-card-border/60 bg-bg-secondary/20 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                className="p-2 bg-white/5 hover:bg-accent-blue/10 border border-card-border rounded-xl text-text-secondary hover:text-white transition-all cursor-pointer"
                title={isRtl ? 'تبديل القائمة الجانبية' : 'Toggle Sidebar'}
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white truncate">{activeSessionTitle}</h2>
                {selectedProjectId && (
                  <p className="text-[9px] text-accent-blue font-mono font-bold mt-0.5 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse"></span>
                    {projects.find(p => p._id === selectedProjectId)?.name || 'Scope Locked'}
                  </p>
                )}
              </div>
            </div>

            {/* Toggle code preview button */}
            {drawerCode && (
              <button
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-accent-blue/10 border border-card-border rounded-xl text-[10px] font-bold text-accent-blue cursor-pointer transition-all"
                title={isRtl ? 'تبديل مساحة الكود' : 'Toggle Code Space'}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>{rightPanelOpen ? (isRtl ? 'إخفاء الكود' : 'Hide Code') : (isRtl ? 'عرض الكود' : 'Show Code')}</span>
              </button>
            )}
          </div>

          {/* Chat thread list */}
          <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 select-text custom-scrollbar">
            <div className="max-w-4xl mx-auto w-full space-y-6">
              {messages.length > 0 ? (
                messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start space-x-4 max-w-[92%] animate-fade-in ${
                      m.sender === 'user' ? (isRtl ? 'mr-auto flex-row-reverse space-x-reverse' : 'ml-auto flex-row-reverse space-x-reverse') : ''
                    }`}
                  >
                    {/* User / AI Avatar */}
                    {(() => {
                      if (m.sender === 'user') {
                        return (
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs ring-1 bg-accent-blue/15 text-accent-blue ring-accent-blue/20">
                            {getUserInitials()}
                          </div>
                        );
                      }
                      const info = getAgentAvatarAndStyles(m.senderName);
                      return (
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs ring-1 ${info.styles}`}>
                          {info.avatar}
                        </div>
                      );
                    })()}
                    
                    {/* Chat Bubble card */}
                    <div className="flex flex-col space-y-1.5 min-w-0 flex-1">
                      {m.sender === 'assistant' && (
                        <span className="text-[10px] font-bold text-text-secondary px-1 flex items-center gap-1.5">
                          {getAgentAvatarAndStyles(m.senderName).displayName}
                          <span className="text-[8px] font-normal text-text-muted font-mono">
                            {(() => {
                              try {
                                if (!m.createdAt) return '';
                                const d = new Date(m.createdAt);
                                return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              } catch {
                                return '';
                              }
                            })()}
                          </span>
                        </span>
                      )}

                      <div className={`p-4 rounded-[22px] text-xs leading-relaxed whitespace-pre-wrap shadow-sm ${
                        m.sender === 'user'
                          ? 'bg-accent-blue text-white font-medium rounded-tr-none'
                          : 'bg-card-bg/40 border border-card-border/80 glass text-[#E2E8F0] rounded-tl-none'
                      }`}>
                        {m.text}
                      </div>

                      {m.isLimit && (
                        <div className="pt-1">
                          <button
                            onClick={() => router.push('/billing')}
                            className="flex items-center px-4 py-2.5 bg-gradient-to-r from-accent-blue to-indigo-600 hover:from-accent-blue hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-accent-blue/20"
                          >
                            {t('upgradeSubscription')}
                            <ArrowRight className={`w-4 h-4 ${isRtl ? 'mr-1.5 rotate-180' : 'ml-1.5'}`} />
                          </button>
                        </div>
                      )}

                      {/* Reference cards for citations */}
                      {m.citations && m.citations.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[9px] uppercase tracking-widest text-text-muted font-bold block px-1">
                            {isRtl ? 'المراجع المستند إليها:' : 'Cited References:'}
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {m.citations.map((c, i) => (
                              <div
                                key={i}
                                onClick={() => handleOpenCitation(c)}
                                className="inline-flex items-center px-3 py-1.5 bg-bg-secondary/40 border border-card-border/60 hover:bg-white/5 hover:border-accent-blue/30 rounded-xl text-[9px] text-text-secondary hover:text-white transition-all cursor-pointer font-mono"
                              >
                                <FileCode className={`w-3 h-3 ${isRtl ? 'ml-1.5' : 'mr-1.5'} text-accent-blue`} />
                                {c.fileName}
                                {c.score && (
                                  <span className="text-[8px] text-emerald-400 font-bold ml-1">
                                    ({(c.score * 100).toFixed(0)}%)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                /* Premium Claude/ChatGPT welcome starting board */
                <div className="h-full flex flex-col justify-center items-center space-y-8 py-10">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-[24px] bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center shadow-lg shadow-accent-blue/5">
                      <Sparkles className="w-8 h-8 text-accent-blue animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <h1 className="text-2xl font-bold tracking-tight text-white">
                        {isRtl ? 'كيف يمكنني مساعدتك اليوم؟' : 'How can I help you today?'}
                      </h1>
                      <p className="text-xs text-text-secondary max-w-lg leading-relaxed">
                        {t('askAnythingRepo')}
                      </p>
                    </div>
                  </div>

                  {/* Prompt recommendations */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full pt-4">
                    {quickPrompts.map((item, index) => (
                      <div
                        key={index}
                        onClick={() => handleSendMessage(undefined, item.prompt)}
                        className="group cursor-pointer p-4 rounded-2xl border border-card-border/60 bg-bg-secondary/30 hover:bg-bg-secondary/50 hover:border-accent-blue/30 transition-all flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-accent-blue opacity-85" />
                            {item.title}
                          </h4>
                          <p className="mt-1.5 text-[10px] text-text-secondary leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                        <div className="flex justify-end">
                          <span className="text-[10px] text-accent-blue font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            {isRtl ? 'اسأل الآن' : 'Ask now'}
                            <ArrowRight className={`w-3 h-3 ${isRtl ? 'rotate-180' : ''}`} />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Jumping dots loader */}
              {sending && (
                <div className="flex items-start space-x-4 max-w-[80%] animate-pulse">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="p-4 bg-card-bg/40 border border-card-border/60 rounded-xl rounded-tl-none flex items-center space-x-1.5 py-3">
                    <div className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
            
            <div ref={messagesEndRef} />
          </div>

          {/* Typing input area */}
          <div className="p-5 border-t border-card-border/60 bg-bg-secondary/40 backdrop-blur-md">
            <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative flex items-center">
              <input
                type="text"
                placeholder={t('askAiAboutRepos')}
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                disabled={sending}
                className="w-full bg-bg-primary/60 border border-card-border focus:border-accent-blue/50 rounded-2xl py-4 pl-5 pr-14 text-xs text-white outline-none transition-all placeholder:text-text-muted"
              />
              <button
                type="submit"
                disabled={sending || !inputMsg.trim()}
                className={`
                  absolute p-3 rounded-xl transition-all cursor-pointer
                  ${isRtl ? 'left-2' : 'right-2'}
                  ${sending || !inputMsg.trim() ? 'bg-accent-blue/40 text-white/50' : 'bg-accent-blue hover:bg-accent-blue/90 text-white shadow-md shadow-accent-blue/15'}
                `}
              >
                {sending ? (
                  <div className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Send className="w-4.5 h-4.5" />
                )}
              </button>
            </form>
          </div>
        </div>

        {/* 3. Right Slide-out Panel: Collapsible Monaco Source Code Preview */}
        <div className={`
          absolute xl:static top-0 bottom-0 z-40 bg-bg-secondary flex flex-col h-full transition-all duration-300
          ${isRtl ? 'border-r left-0 right-auto' : 'border-l right-0 left-auto'}
          ${rightPanelOpen && drawerCode ? 'w-full xl:w-[42%] max-w-[560px] translate-x-0' : 'w-0 overflow-hidden translate-x-full xl:translate-x-0'}
        `}>
          <div className="flex items-center justify-between p-4 border-b border-card-border/60 w-full min-w-[360px] xl:max-w-[560px]">
            <div className="flex items-center gap-2 min-w-0">
              <FileCode className="w-4 h-4 text-accent-blue shrink-0" />
              <span className="text-xs font-bold text-white truncate max-w-[220px]">
                {drawerTitle || t('codeWorkspace')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyCode}
                className="p-2 hover:bg-white/5 border border-transparent hover:border-card-border rounded-xl text-text-secondary hover:text-white transition-all cursor-pointer"
                title={t('copyCode')}
              >
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setRightPanelOpen(false)}
                className="p-2 hover:bg-white/5 border border-transparent hover:border-card-border rounded-xl text-text-secondary hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 relative bg-bg-primary select-text w-full min-w-[360px] xl:max-w-[560px]">
            {drawerCode ? (
              <Editor
                height="100%"
                language={drawerLanguage}
                theme="vs-dark"
                value={drawerCode}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 12 },
                }}
              />
            ) : (
              <div className="flex h-full flex-col justify-between p-6">
                <div>
                  <div className="mb-6 rounded-[22px] border border-card-border bg-card-bg/25 p-5 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-accent-blue" />
                    </div>
                    <h3 className="text-sm font-bold text-white">{t('contextAwareCodePreview')}</h3>
                    <p className="text-xs leading-relaxed text-text-secondary">
                      {t('askQuestionToPreview')}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[10px]">
                    {[t('codeExplanation'), t('dependencies'), t('optimizations'), t('securityAnalysisLabel')].map((item) => (
                      <div key={item} className="rounded-xl border border-card-border/60 bg-white/[0.02] p-3 text-text-secondary font-medium font-bold">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-card-border bg-bg-secondary/40 p-4 text-[10px] leading-relaxed text-text-muted flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-accent-blue" />
                  {t('loadedSourcesCount', { count: sourceFiles.length })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile backdrop for right panel */}
        {rightPanelOpen && drawerCode && (
          <div 
            onClick={() => setRightPanelOpen(false)} 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 xl:hidden"
          />
        )}
      </main>

      <CommandPalette />
    </div>
  );
}

export default function AIChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-primary" />}>
      <AIChatPageContent />
    </Suspense>
  );
}
