'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCommand } from '@/context/CommandContext';
import { useAuth } from '@/context/AuthContext';
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

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
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
      router.push(`/projects/${result.projectId}?fileId=${result.type === 'codeEntity' ? result.id : result.id}`);
    } else if (result.type === 'snippet') {
      router.push(`/snippets?id=${result.id}`);
    } else if (result.type === 'errorSolution') {
      router.push(`/errors?id=${result.id}`);
    }
  };

  const handleAskAIClick = (e: React.MouseEvent, result: any) => {
    e.stopPropagation();
    setIsOpen(false);
    router.push(`/chat?projectId=${result.projectId || ''}&ask=${encodeURIComponent(`Explain this section of code: ${result.name}`)}`);
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

  return (
    <div className="fixed inset-0 z-50 bg-bg-primary/75 backdrop-blur-md flex items-start justify-center pt-24 px-4 select-none">
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-card-bg border border-card-border rounded-[28px] shadow-2xl overflow-hidden glass hover-scale"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-6 py-4 border-b border-card-border">
          <Search className="w-5 h-5 text-text-secondary mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search files, functions, errors, snippets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder-text-secondary outline-none border-none py-1"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-4 space-y-1">
          {results.length > 0 ? (
            results.map((r) => (
              <div
                key={r.id}
                onClick={() => handleResultClick(r)}
                className="group flex items-center justify-between p-3.5 rounded-2xl hover:bg-white/5 transition-all duration-150 cursor-pointer"
              >
                <div className="flex items-start space-x-3.5 max-w-[70%]">
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
                    {(r.score * 100).toFixed(0)}% match
                  </span>

                  {/* Actions buttons */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1.5 transition-all duration-150">
                    <button
                      onClick={(e) => handleAskAIClick(e, r)}
                      className="p-1.5 hover:bg-accent-blue/20 hover:text-white rounded-lg text-text-secondary transition-colors"
                      title="Ask AI"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    {r.content && (
                      <button
                        onClick={(e) => handleCopyCode(e, r.id, r.content)}
                        className={`p-1.5 hover:bg-white/10 rounded-lg text-text-secondary transition-colors ${
                          copiedId === r.id ? 'text-success hover:bg-success/20' : ''
                        }`}
                        title="Copy Code"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      className="p-1.5 hover:bg-white/10 hover:text-white rounded-lg text-text-secondary transition-colors"
                      title="Open"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : query ? (
            <div className="py-8 text-center text-xs text-text-secondary">
              No matching records found in your engineering memory.
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-text-secondary flex flex-col items-center justify-center space-y-2">
              <span className="opacity-75 font-medium">Spotlight engineering search active.</span>
              <span className="text-[10px] opacity-50">Type to search code segments, file descriptions, logged errors or custom snippets.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default CommandPalette;
