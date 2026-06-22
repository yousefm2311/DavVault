'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
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
  Check
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
}

export default function AIChatPage() {
  const { user, loading, apiFetch } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
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
    } catch (err) {
      console.error('[Chat]: Message dispatch failed:', err);
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

  if (loading || !user) return null;

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none">
      <Sidebar />

      <main className="flex-1 flex overflow-hidden h-screen">
        {/* Left Side: Sessions List Drawer (1/4 width) */}
        <div className="w-64 border-r border-card-border bg-bg-secondary p-5 flex flex-col justify-between select-none">
          <div className="space-y-4">
            <button
              onClick={handleStartNewSession}
              className="w-full flex items-center justify-center py-2.5 bg-white/5 border border-card-border hover:bg-white/10 rounded-2xl text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Conversation
            </button>

            <div className="space-y-2">
              <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold px-2">
                Project Scope
              </span>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-card-bg/40 border border-card-border rounded-xl py-2 px-3 text-xs text-white outline-none"
              >
                <option value="">Search all repos</option>
                {projects.map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 overflow-y-auto max-h-[350px]">
              <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold px-2 block mb-1">
                Recent Chats
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
                <div className="text-[10px] text-text-secondary/50 px-2 py-4">No recent chats.</div>
              )}
            </div>
          </div>
        </div>

        {/* Middle: Chat Bubble Window (expanded / flex) */}
        <div className="flex-1 flex flex-col justify-between bg-bg-primary h-full relative">
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

                    {/* Source Citations for assistant replies */}
                    {m.citations && m.citations.length > 0 && (
                      <div className="flex flex-wrap gap-2.5 pt-1.5">
                        {m.citations.map((c, i) => (
                          <div
                            key={i}
                            onClick={() => handleOpenCitation(c)}
                            className="inline-flex items-center px-2.5 py-1 bg-white/5 border border-white/5 hover:bg-white/10 hover:border-accent-blue/40 rounded-lg text-[9px] text-text-secondary hover:text-white transition-all cursor-pointer font-mono"
                          >
                            <FileCode className="w-3.5 h-3.5 mr-1.5 text-accent-blue" />
                            {c.fileName}
                            {c.score && (
                              <span className="text-[8px] opacity-60 ml-1.5">
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
                  <span className="text-white font-medium">DevVault AI Assistant</span>
                  <span>Ask anything about your uploaded codebases and old engineering knowledge.</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt input field */}
          <form onSubmit={handleSendMessage} className="p-6 border-t border-card-border bg-bg-secondary flex space-x-3 items-center">
            <input
              type="text"
              placeholder="Ask DevVault AI about your codebases..."
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

        {/* Right Split Panel: Monaco code citation viewer */}
        {drawerCode && (
          <div className="w-96 border-l border-card-border bg-bg-secondary flex flex-col h-full animate-fade-in relative z-20">
            <div className="flex items-center justify-between p-4 border-b border-card-border">
              <div className="flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-accent-blue" />
                <span className="text-xs font-semibold text-white max-w-[180px] truncate">
                  {drawerTitle}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white"
                  title="Copy code"
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
            </div>
          </div>
        )}
      </main>

      <CommandPalette />
    </div>
  );
}
