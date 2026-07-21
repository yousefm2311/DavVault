'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { AppPageSkeleton, SectionSkeleton } from '@/components/LoadingStates';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code,
  Plus,
  Copy,
  Check,
  Search,
  Trash2,
  BookOpen,
  Info
} from 'lucide-react';

const isValidObjectIdString = (value?: string) => (
  typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value)
);

function SnippetsPageContent() {
  const { user, loading, apiFetch } = useAuth();
  const { t, dir } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [snippets, setSnippets] = useState<any[]>([]);
  const [loadingSnippets, setLoadingSnippets] = useState(true);
  const [snippetsError, setSnippetsError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [explanation, setExplanation] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Details drawer
  const [selectedSnippet, setSelectedSnippet] = useState<any | null>(null);
  const isRtl = dir === 'rtl';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

  const fetchSnippets = async () => {
    try {
      setLoadingSnippets(true);
      setSnippetsError('');
      const data = await apiFetch('/snippets');
      setSnippets(data.snippets || []);
      
      // Auto-open snippet if referenced in URL query parameters
      const urlId = searchParams.get('id');
      if (urlId && data.snippets) {
        const found = isValidObjectIdString(urlId)
          ? data.snippets.find((s: any) => s._id === urlId)
          : null;
        setSelectedSnippet(found || null);
      }
    } catch (err) {
      console.error('[Snippets]: Fetch failed:', err);
      setSnippetsError(err instanceof Error ? err.message : 'Unable to load snippets.');
    } finally {
      setLoadingSnippets(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchSnippets();
  }, [user, searchParams]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !code || !language) return;

    setSubmitting(true);
    const tags = tagsStr
      .split(',')
      .map(t => t.trim())
      .filter(t => t !== '');

    try {
      setSnippetsError('');
      const data = await apiFetch('/snippets', {
        method: 'POST',
        body: JSON.stringify({
          title,
          code,
          language,
          explanation,
          tags,
        }),
      });

      setSnippets(prev => [data.snippet, ...prev]);
      setShowAddForm(false);
      setTitle('');
      setCode('');
      setExplanation('');
      setTagsStr('');
    } catch (err) {
      console.error('[Snippets]: Save failed:', err);
      setSnippetsError(err instanceof Error ? err.message : 'Unable to save snippet.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDelete = async (id: string) => {
    if (!isValidObjectIdString(id)) {
      setSnippetsError('Unable to delete snippet: invalid snippet id.');
      return;
    }
    if (!confirm(t('deleteSnippetConfirm'))) return;
    setDeletingId(id);
    try {
      setSnippetsError('');
      await apiFetch(`/snippets/${id}`, { method: 'DELETE' });
      setSnippets(prev => prev.filter(s => s._id !== id));
      if (selectedSnippet?._id === id) setSelectedSnippet(null);
    } catch (err) {
      console.error('[Snippets]: Delete failed:', err);
      setSnippetsError(err instanceof Error ? err.message : 'Unable to delete snippet.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading || !user) return <AppPageSkeleton label={t('loadingSnippets')} />;

  // Filter snippets locally by keyword
  const filteredSnippets = snippets.filter(s =>
    String(s.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(s.language || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.tags || []).some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none" dir={dir}>
      <Sidebar />

      <motion.main
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex-1 p-10 overflow-y-auto max-w-5xl mx-auto flex flex-col"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t('snippetsVault')}</h2>
            <p className="text-xs text-text-secondary mt-1">{t('snippetsVaultDesc')}</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center px-4 py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-xs font-semibold rounded-2xl transition-all shadow-md shadow-accent-blue/10 cursor-pointer"
          >
            <Plus className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
            {t('addSnippet')}
          </button>
        </div>

        {/* Add Snippet Panel */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-8 bg-card-bg/60 border border-card-border p-6 rounded-[28px] glass overflow-hidden"
            >
              <h3 className="font-bold text-sm mb-4">{t('addNewSnippet')}</h3>
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('snippetTitle')}</label>
                    <input
                      type="text"
                      placeholder={t('exampleSupabaseAuth')}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('language')}</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                    >
                      <option value="javascript">JavaScript</option>
                      <option value="typescript">TypeScript</option>
                      <option value="dart">Dart</option>
                      <option value="python">Python</option>
                      <option value="php">PHP</option>
                      <option value="json">JSON</option>
                      <option value="yaml">YAML</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('snippetCode')}</label>
                  <textarea
                    placeholder={t('pasteReusableCode')}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    rows={6}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs font-mono text-white outline-none focus:border-accent-blue/50"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('explanation')}</label>
                    <input
                      type="text"
                      placeholder={t('shortExplanation')}
                      value={explanation}
                      onChange={(e) => setExplanation(e.target.value)}
                      className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('tagsCommaSeparated')}</label>
                    <input
                      type="text"
                      placeholder="supabase, auth, upload"
                      value={tagsStr}
                      onChange={(e) => setTagsStr(e.target.value)}
                      className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-semibold"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-accent-blue/50 text-white rounded-2xl text-xs font-semibold"
                  >
                    {submitting ? t('savingSnippet') : t('saveSnippet')}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter Input */}
        <div className="mb-6 relative max-w-sm">
          <Search className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-3.5 w-4 h-4 text-text-secondary`} />
          <input
            type="text"
            placeholder={t('filterSnippets')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-card-bg/40 border border-card-border rounded-2xl py-3 ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'} text-xs text-white placeholder-text-secondary outline-none focus:border-accent-blue/50 transition-colors`}
          />
        </div>

        {snippetsError && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-xs text-danger">
            <span>{snippetsError}</span>
            <button type="button" onClick={fetchSnippets} className="rounded-xl border border-danger/20 px-3 py-1 text-[10px] font-semibold">
              Retry
            </button>
          </div>
        )}

        {/* Snippets layout: Grid + Drawer Split */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* List section */}
          <div className="md:col-span-2 space-y-4">
            {loadingSnippets ? (
              <SectionSkeleton rows={4} />
            ) : filteredSnippets.length > 0 ? (
              <motion.div
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.08
                    }
                  }
                }}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                {filteredSnippets.map((snippet) => (
                  <motion.div
                    key={snippet._id}
                    variants={{
                      hidden: { opacity: 0, y: 15 },
                      show: { opacity: 1, y: 0 }
                    }}
                    onClick={() => setSelectedSnippet(snippet)}
                    className={`p-5 rounded-[24px] border transition-all duration-150 cursor-pointer flex flex-col justify-between h-[160px] hover:bg-white/5 ${
                      selectedSnippet?._id === snippet._id
                        ? 'bg-white/5 border-accent-blue'
                        : 'bg-card-bg/40 border-card-border'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center">
                            <Code className="w-4 h-4 text-accent-blue" />
                          </div>
                          <h3 className="font-bold text-xs text-white max-w-[120px] truncate">{snippet.title}</h3>
                        </div>
                        <span className="text-[9px] font-mono text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded-full uppercase">
                          {snippet.language}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-secondary mt-3 line-clamp-2 leading-relaxed">
                        {snippet.explanation || t('noExplanation')}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-card-border/40">
                      <div className="flex gap-1 overflow-hidden max-w-[70%]">
                        {(snippet.tags || []).slice(0, 2).map((tagItem: string) => (
                          <span
                              key={tagItem}
                              className="text-[9px] bg-white/5 px-2 py-0.5 rounded-md text-text-secondary truncate"
                            >
                            {tagItem}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(snippet._id, snippet.code);
                          }}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white"
                          title={t('copyCode')}
                        >
                          {copiedId === snippet._id ? (
                            <Check className="w-3.5 h-3.5 text-success" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(snippet._id);
                          }}
                          disabled={deletingId === snippet._id}
                          className="p-1.5 hover:bg-danger/10 rounded-lg text-text-secondary hover:text-danger"
                          title={t('cancel')}
                        >
                          {deletingId === snippet._id ? (
                            <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-danger animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="py-20 text-center text-xs text-text-secondary flex flex-col items-center justify-center space-y-4 bg-card-bg/25 border border-card-border rounded-[28px]">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-accent-blue" />
                </div>
                <span>{t('noSnippetsText')}</span>
              </div>
            )}
          </div>

          {/* Details preview panel (1/3 width) */}
          <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass min-h-[300px] flex flex-col justify-between overflow-hidden">
            <AnimatePresence mode="wait">
              {selectedSnippet ? (
                <motion.div
                  key={selectedSnippet._id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5 flex-1 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-sm text-white">{selectedSnippet.title}</h3>
                      <span className="text-[9px] font-mono text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded-full uppercase">
                        {selectedSnippet.language}
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold">{t('aiExplanation')}</span>
                        <p className="text-xs text-text-secondary leading-relaxed bg-white/5 p-3 rounded-xl">
                          {selectedSnippet.explanation || t('noSummary')}
                        </p>
                      </div>

                      <div className="space-y-1 flex-1">
                        <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold">{t('codePreview')}</span>
                        <pre className="p-3 bg-bg-primary rounded-xl overflow-x-auto text-[10px] font-mono text-[#E0E0E0] max-h-[180px]" dir="ltr">
                          <code>{selectedSnippet.code}</code>
                        </pre>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopy(selectedSnippet._id, selectedSnippet.code)}
                    className="w-full py-3 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-2xl text-xs font-semibold transition-colors cursor-pointer flex justify-center items-center"
                  >
                    {copiedId === selectedSnippet._id ? (
                      <>
                        <Check className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'} text-success`} />
                        {t('copied')}
                      </>
                    ) : (
                      <>
                        <Copy className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
                        {t('copyCode')}
                      </>
                    )}
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  exit={{ opacity: 0 }}
                  className="py-20 text-center text-xs text-text-secondary flex flex-col items-center justify-center space-y-3 h-full justify-center"
                >
                  <Info className="w-5 h-5 text-accent-blue opacity-50" />
                  <span>{t('chooseSnippetToPreview')}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.main>

      <CommandPalette />
    </div>
  );
}

export default function SnippetsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-primary" />}>
      <SnippetsPageContent />
    </Suspense>
  );
}
