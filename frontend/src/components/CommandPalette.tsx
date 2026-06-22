'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCommand } from '@/context/CommandContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  Search,
  FileCode,
  Code,
  Bug,
  BookOpen,
  ArrowRight,
  Sparkles,
  Copy,
  FolderOpen
} from 'lucide-react';

export const CommandPalette: React.FC = () => {
  const { isOpen, setIsOpen } = useCommand();
  const { apiFetch } = useAuth();
  const router = useRouter();
  const { t, dir } = useLanguage();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on modal open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
      setActiveFilter('all');
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Debounced search trigger
  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch('/search', {
          method: 'POST',
          body: JSON.stringify({ query }),
        });
        setResults(data.results || []);
      } catch (err) {
        console.error('[CommandPalette]: Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const handleCopyCode = (e: React.MouseEvent, id: string, code: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleResultClick = (result: any) => {
    setIsOpen(false);
    if (result.type === 'file' || result.type === 'codeEntity') {
      const fileId = result.type === 'codeEntity' ? result.fileId || result.id : result.id;
      router.push(`/projects/${result.projectId}?fileId=${fileId}`);
    } else if (result.type === 'snippet') {
      router.push(`/snippets?id=${result.id}`);
    } else if (result.type === 'errorSolution') {
      router.push(`/errors?id=${result.id}`);
    }
  };

  const handleAskAIClick = (e: React.MouseEvent, result: any) => {
    e.stopPropagation();
    setIsOpen(false);
    router.push(`/chat?projectId=${result.projectId || ''}&ask=${encodeURIComponent(t('explainCodePart', { name: result.name }))}`);
  };

  if (!isOpen) return null;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'file':
        return <FileCode className="w-4 h-4 text-accent-blue" />;
      case 'codeEntity':
        return <Code className="w-4 h-4 text-success" />;
      case 'snippet':
        return <BookOpen className="w-4 h-4 text-warning" />;
      case 'errorSolution':
        return <Bug className="w-4 h-4 text-danger" />;
      default:
        return <FileCode className="w-4 h-4 text-text-secondary" />;
    }
  };

  const filters = [
    { id: 'all', label: t('all'), count: results.length },
    { id: 'file', label: t('file'), count: results.filter((r) => r.type === 'file').length },
    { id: 'codeEntity', label: t('codeEntity'), count: results.filter((r) => r.type === 'codeEntity').length },
    { id: 'snippet', label: t('snippet'), count: results.filter((r) => r.type === 'snippet').length },
    { id: 'errorSolution', label: t('errorSolutionFilter'), count: results.filter((r) => r.type === 'errorSolution').length },
  ];

  const visibleResults = activeFilter === 'all'
    ? results
    : results.filter((result) => result.type === activeFilter);

  return (
    <div className="fixed inset-0 z-50 bg-bg-primary/80 backdrop-blur-xl flex items-start justify-center pt-10 md:pt-20 px-4 select-none" dir={dir}>
      <div
        ref={modalRef}
        className="w-full max-w-4xl bg-card-bg/95 border border-card-border rounded-[28px] shadow-2xl shadow-black/40 overflow-hidden glass"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-6 py-5 border-b border-card-border">
          <Search className="w-5 h-5 text-text-secondary ml-3 ltr:mr-3 ltr:ml-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder={t('searchPalettePlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-base text-white placeholder-text-secondary outline-none border-none py-1"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
          )}
        </div>

        <div className="grid min-h-[420px] grid-cols-1 md:grid-cols-[180px_1fr]">
          <aside className="hidden border-l ltr:border-l-0 ltr:border-r border-card-border bg-bg-primary/35 p-3 md:block">
            <div className="space-y-1">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-xs font-semibold transition ${
                    activeFilter === filter.id
                      ? 'bg-white/10 text-white'
                      : 'text-text-secondary hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span>{filter.label}</span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] text-text-muted">
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-card-border bg-white/[0.03] p-3 text-[10px] leading-relaxed text-text-muted">
              <FolderOpen className="mb-2 h-4 w-4 text-accent-blue" />
              {t('searchPaletteGuide')}
            </div>
          </aside>

          {/* Results List */}
          <div className="max-h-[520px] overflow-y-auto p-4 space-y-1">
          {visibleResults.length > 0 ? (
            visibleResults.map((r) => (
              <div
                key={r.id}
                onClick={() => handleResultClick(r)}
                className="group flex items-center justify-between p-3.5 rounded-2xl hover:bg-white/5 transition-all duration-150 cursor-pointer border border-transparent hover:border-white/5"
              >
                <div className="flex items-start gap-3.5 max-w-[70%]">
                  <div className="mt-1 w-8 h-8 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                    {getTypeIcon(r.type)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-white truncate max-w-[320px]">
                      {r.name}
                    </span>
                    <span className="text-[10px] text-text-secondary truncate mt-0.5 max-w-[280px]">
                      {r.projectName} / {r.path}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Similarity Percentage badge */}
                  <span className="text-[10px] bg-accent-blue/10 border border-accent-blue/15 px-2 py-0.5 rounded-full font-mono text-accent-blue">
                    {t('matchScore', { score: ((r.score || 0) * 100).toFixed(0) })}
                  </span>

                  {/* Actions buttons */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1.5 transition-all duration-150">
                    <button
                      onClick={(e) => handleAskAIClick(e, r)}
                      className="p-1.5 hover:bg-accent-blue/20 hover:text-white rounded-lg text-text-secondary transition-colors"
                      title={t('askAi')}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    {r.content && (
                      <button
                        onClick={(e) => handleCopyCode(e, r.id, r.content)}
                        className={`p-1.5 hover:bg-white/10 rounded-lg text-text-secondary transition-colors ${
                          copiedId === r.id ? 'text-success hover:bg-success/20' : ''
                        }`}
                        title={t('copyCode')}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      className="p-1.5 hover:bg-white/10 hover:text-white rounded-lg text-text-secondary transition-colors"
                      title={t('open')}
                    >
                      <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : query ? (
            <div className="py-16 text-center text-xs text-text-secondary">
              {t('noMatchResults')}
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-text-secondary flex flex-col items-center justify-center space-y-2">
              <span className="opacity-75 font-medium text-white">{t('smartSearchReady')}</span>
              <span className="text-[10px] opacity-50">{t('smartSearchInstruction')}</span>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default CommandPalette;
