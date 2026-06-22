'use client';

import React, { Suspense, useState, useEffect, useRef } from 'react';
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
  Terminal,
  FolderCode,
  Maximize2,
  Minimize2,
  X,
  Copy,
  Check,
  ArrowRight
} from 'lucide-react';

interface Citation {
  fileName: string;
  path: string;
  code?: string;
  score?: number;
}

interface Message {
  sender: 'user' | 'assistant';
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

  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Input states
  const [inputMsg, setInputMsg] = useState('');
  const [sending, setSending] = useState(false);

  // Split-screen / Side drawer code viewer
  const [drawerCode, setDrawerCode] = useState<string | null>(null);
  const [drawerTitle, setDrawerTitle] = useState('');
  const [drawerLanguage, setDrawerLanguage] = useState('javascript');
  const [copied, setCopied] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isRtl = dir === 'rtl';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

  const loadInitialData = async () => {
    try {
      const [projectsData, sessionsData] = await Promise.all([
        apiFetch('/projects'),
        apiFetch('/ai/sessions'),
      ]);

      setProjects(projectsData.projects || []);
      setSessions(sessionsData.sessions || []);

      // If project scope is passed via URL query
      const urlProjectId = searchParams.get('projectId');
      if (urlProjectId) setSelectedProjectId(urlProjectId);

      // If initial question is passed via URL query
      const urlAsk = searchParams.get('ask');
      if (urlAsk) {
        setInputMsg(decodeURIComponent(urlAsk));
      }
    } catch (err) {
      console.error('[Chat]: Initial loading failed:', err);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadInitialData();
  }, [user, searchParams]);

  useEffect(() => {
    if (!user || !selectedProjectId) {
      setSourceFiles([]);
      return;
    }

    const loadSourceFiles = async () => {
      try {
        const data = await apiFetch(`/projects/${selectedProjectId}/files`);
        setSourceFiles((data.files || []).slice(0, 18));
      } catch (err) {
        console.error('[Chat]: Failed to load source files:', err);
        setSourceFiles([]);
      }
    };

    loadSourceFiles();
  }, [user, selectedProjectId]);

  // Scroll to bottom when message arrives
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || sending) return;

    const userMessageText = inputMsg;
    setInputMsg('');
    setSending(true);

    // Optimistically push user message
    const userMsg: Message = { sender: 'user', text: userMessageText, createdAt: new Date() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const data = await apiFetch('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: userMessageText,
          sessionId: activeSessionId || undefined,
          projectId: selectedProjectId || undefined,
        }),
      });

      // Update messages with citations
      const assistantMsg: Message = {
        sender: 'assistant',
        text: data.answer,
        citations: data.citations || [],
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // If it was a new session, update lists
      if (!activeSessionId) {
        setActiveSessionId(data.sessionId);
        // Refresh sessions list
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
    }
  };

  const handleCopyCode = () => {
    if (!drawerCode) return;
    navigator.clipboard.writeText(drawerCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading || !user) return <AppPageSkeleton label={t('loadingChatSpace')} />;

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none" dir={dir}>
      <Sidebar />

      <main className="flex-1 flex overflow-hidden h-screen">
        {/* Left Side: Sources and sessions panel */}
        <div className={`hidden lg:flex w-72 ${isRtl ? 'border-r' : 'border-l'} border-card-border bg-bg-secondary p-5 flex-col justify-between select-none`}>
          <div className="space-y-4">
            <button
              onClick={handleStartNewSession}
              className="w-full flex items-center justify-center py-2.5 bg-white/5 border border-card-border hover:bg-white/10 rounded-2xl text-xs font-semibold cursor-pointer"
            >
              <Plus className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
              {t('newChat')}
            </button>

            <div className="space-y-2">
              <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold px-2">
                {t('projectScope')}
              </span>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-card-bg/40 border border-card-border rounded-xl py-2 px-3 text-xs text-white outline-none"
              >
                <option value="">{t('searchAllRepos')}</option>
                {projects.map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold px-2 block">
                {t('loadedSources')}
              </span>
              <div className="max-h-[260px] overflow-y-auto rounded-2xl border border-card-border bg-bg-primary/40 p-2">
                {sourceFiles.length > 0 ? (
                  sourceFiles.map((file) => (
                    <button
                      key={file._id}
                      onClick={() => {
                        setDrawerTitle(file.fileName);
                        setDrawerCode(file.summary || t('openSourceDetails', { path: file.path }));
                        setDrawerLanguage('markdown');
                      }}
                      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 ${isRtl ? 'text-right' : 'text-left'} text-[10px] text-text-secondary transition hover:bg-white/5 hover:text-white`}
                    >
                      <FileCode className="h-3.5 w-3.5 shrink-0 text-accent-blue" />
                      <span className="min-w-0 flex-1 truncate font-mono">{file.path}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-2 py-6 text-center text-[10px] leading-relaxed text-text-muted">
                    {t('chooseProjectToLoadFiles')}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5 overflow-y-auto max-h-[220px]">
              <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold px-2 block mb-1">
                {t('recentChats')}
              </span>
              {sessions.length > 0 ? (
                sessions.map((s) => (
                  <div
                    key={s._id}
                    onClick={() => fetchSessionMessages(s._id)}
                    className={`px-3 py-2.5 rounded-xl text-xs truncate cursor-pointer transition-colors ${
                      activeSessionId === s._id ? 'bg-accent-blue text-white' : 'text-text-secondary hover:bg-card-bg/60 hover:text-white'
                    }`}
                  >
                    {s.title}
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-text-secondary/50 px-2 py-4">{t('noRecentChats')}</div>
              )}
            </div>
          </div>
        </div>

        {/* Middle: Chat Bubble Window (expanded / flex) */}
        <div className="flex-1 flex flex-col justify-between bg-bg-primary h-full relative min-w-0">
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            {messages.length > 0 ? (
              messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex items-start space-x-4 max-w-[80%] ${
                    m.sender === 'user' ? 'ml-auto flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    m.sender === 'user' ? 'bg-accent-blue/15 text-accent-blue' : 'bg-white/5 border border-white/5 text-success'
                  }`}>
                    {m.sender === 'user' ? <Plus className="w-4 h-4" /> : <Sparkle className="w-4 h-4" />}
                  </div>
                  
                  <div className="flex flex-col space-y-2">
                    <div className={`p-4 rounded-[24px] text-xs leading-relaxed whitespace-pre-wrap ${
                      m.sender === 'user' ? 'bg-accent-blue text-white' : 'bg-card-bg/40 border border-card-border glass text-[#E0E0E0]'
                    }`}>
                      {m.text}
                    </div>

                    {m.isLimit && (
                      <div className="pt-1">
                        <button
                          onClick={() => router.push('/billing')}
                          className="flex items-center px-4 py-2 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-lg shadow-accent-blue/10"
                        >
                          {t('upgradeSubscription')}
                          <ArrowRight className={`w-4 h-4 ${isRtl ? 'mr-1.5 rotate-180' : 'ml-1.5'}`} />
                        </button>
                      </div>
                    )}

                    {/* Source Citations for assistant replies */}
                    {m.citations && m.citations.length > 0 && (
                      <div className="flex flex-wrap gap-2.5 pt-1.5">
                        {m.citations.map((c, i) => (
                          <div
                            key={i}
                            onClick={() => handleOpenCitation(c)}
                            className="inline-flex items-center px-2.5 py-1 bg-white/5 border border-white/5 hover:bg-white/10 hover:border-accent-blue/40 rounded-lg text-[9px] text-text-secondary hover:text-white transition-all cursor-pointer font-mono"
                          >
                            <FileCode className={`w-3.5 h-3.5 ${isRtl ? 'ml-1.5' : 'mr-1.5'} text-accent-blue`} />
                            {c.fileName}
                            {c.score && (
                              <span className={`text-[8px] opacity-60 ${isRtl ? 'mr-1.5' : 'ml-1.5'}`}>
                                ({(c.score * 100).toFixed(0)}%)
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-24 text-center text-xs text-text-secondary flex flex-col items-center justify-center space-y-4 h-full justify-center">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center animate-pulse">
                  <Sparkles className="w-6 h-6 text-accent-blue" />
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-white font-medium">{t('aiAssistant')}</span>
                  <span>{t('askAnythingRepo')}</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt input field */}
          <form onSubmit={handleSendMessage} className="p-6 border-t border-card-border bg-bg-secondary flex gap-3 items-center">
            <input
              type="text"
              placeholder={t('askAiAboutRepos')}
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              disabled={sending}
              className="flex-1 bg-bg-primary/50 border border-card-border rounded-2xl py-3.5 px-5 text-xs text-white outline-none focus:border-accent-blue/50"
            />
            <button
              type="submit"
              disabled={sending || !inputMsg.trim()}
              className="p-3.5 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-accent-blue/50 text-white rounded-2xl transition-colors cursor-pointer"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Send className="w-4.5 h-4.5" />
              )}
            </button>
          </form>
        </div>

        {/* Right Split Panel: Monaco code citation viewer and AI insights */}
        <div className={`hidden xl:flex w-[40%] max-w-[520px] ${isRtl ? 'border-l' : 'border-r'} border-card-border bg-bg-secondary flex-col h-full animate-fade-in relative z-20`}>
          <div className="flex items-center justify-between p-4 border-b border-card-border">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-accent-blue" />
              <span className="text-xs font-semibold text-white max-w-[180px] truncate">
                {drawerTitle || t('codeWorkspace')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyCode}
                className="p-1.5 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white"
                title={t('copyCode')}
              >
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setDrawerCode(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 relative bg-bg-primary select-text">
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
                }}
              />
            ) : (
              <div className="flex h-full flex-col justify-between p-6">
                <div>
                  <div className="mb-5 rounded-2xl border border-card-border bg-card-bg/40 p-5">
                    <Sparkles className="mb-3 h-5 w-5 text-accent-blue" />
                    <h3 className="text-sm font-bold text-white">{t('contextAwareCodePreview')}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                      {t('askQuestionToPreview')}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[10px]">
                    {[t('codeExplanation'), t('dependencies'), t('optimizations'), t('securityAnalysisLabel')].map((item) => (
                      <div key={item} className="rounded-2xl border border-card-border bg-white/[0.03] p-3 text-text-secondary">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-card-border bg-bg-secondary p-4 text-[10px] leading-relaxed text-text-muted">
                  {t('loadedSourcesCount', { count: sourceFiles.length })}
                </div>
              </div>
            )}
          </div>
        </div>
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
