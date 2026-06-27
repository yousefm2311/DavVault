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
  Bug,
  Plus,
  Search,
  Trash2,
  ChevronRight,
  Info
} from 'lucide-react';

function ErrorsPageContent() {
  const { user, loading, apiFetch } = useAuth();
  const { t, dir } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [errors, setErrors] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [cause, setCause] = useState('');
  const [solution, setSolution] = useState('');
  const [beforeCode, setBeforeCode] = useState('');
  const [afterCode, setAfterCode] = useState('');
  const [projectId, setProjectId] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Selected error for details drawer
  const [selectedError, setSelectedError] = useState<any | null>(null);
  const isRtl = dir === 'rtl';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

  const fetchData = async () => {
    try {
      const [errorsData, projectsData] = await Promise.all([
        apiFetch('/errors'),
        apiFetch('/projects'),
      ]);

      setErrors(errorsData.errors || []);
      setProjects(projectsData.projects || []);

      // Auto-open error if referenced in URL query parameters
      const urlId = searchParams.get('id');
      if (urlId && errorsData.errors) {
        const found = errorsData.errors.find((e: any) => e._id === urlId);
        if (found) setSelectedError(found);
      }
    } catch (err) {
      console.error('[Errors]: Fetch failed:', err);
    } finally {
      setLoadingErrors(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user, searchParams]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !errorMessage || !cause || !solution) return;

    setSubmitting(true);
    const tags = tagsStr
      .split(',')
      .map(t => t.trim())
      .filter(t => t !== '');

    try {
      const data = await apiFetch('/errors', {
        method: 'POST',
        body: JSON.stringify({
          title,
          errorMessage,
          cause,
          solution,
          beforeCode,
          afterCode,
          projectId: projectId || undefined,
          tags,
        }),
      });

      setErrors(prev => [data.errorSolution, ...prev]);
      setShowAddForm(false);
      setTitle('');
      setErrorMessage('');
      setCause('');
      setSolution('');
      setBeforeCode('');
      setAfterCode('');
      setProjectId('');
      setTagsStr('');
    } catch (err) {
      console.error('[Errors]: Save failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteErrorConfirm'))) return;
    try {
      await apiFetch(`/errors/${id}`, { method: 'DELETE' });
      setErrors(prev => prev.filter(e => e._id !== id));
      if (selectedError?._id === id) setSelectedError(null);
    } catch (err) {
      console.error('[Errors]: Delete failed:', err);
    }
  };

  if (loading || !user) return <AppPageSkeleton label={t('loadingErrors')} />;

  // Filter errors by keyword
  const filteredErrors = errors.filter(e =>
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.errorMessage.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.tags || []).some((tItem: string) => tItem.toLowerCase().includes(searchQuery.toLowerCase()))
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
            <h2 className="text-2xl font-bold tracking-tight">{t('errorsLibrary')}</h2>
            <p className="text-xs text-text-secondary mt-1">{t('errorsLibraryDesc')}</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center px-4 py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-xs font-semibold rounded-2xl transition-all shadow-md shadow-accent-blue/10 cursor-pointer"
          >
            <Plus className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
            {t('logError')}
          </button>
        </div>

        {/* Log Exception Form Panel */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-8 bg-card-bg/60 border border-card-border p-6 rounded-[28px] glass overflow-hidden"
            >
            <h3 className="font-bold text-sm mb-4">{t('logSolvedError')}</h3>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('snippetTitle')}</label>
                  <input
                    type="text"
                    placeholder={t('errorTitlePlaceholder')}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('relatedProject')}</label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                  >
                    <option value="">{t('genericNoProject')}</option>
                    {projects.map(p => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('errorMessageLog')}</label>
                <textarea
                  placeholder={t('pasteErrorTrace')}
                  value={errorMessage}
                  onChange={(e) => setErrorMessage(e.target.value)}
                  rows={3}
                  className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs font-mono text-white outline-none focus:border-accent-blue/50"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('errorCause')}</label>
                  <textarea
                    placeholder={t('whyErrorHappened')}
                    value={cause}
                    onChange={(e) => setCause(e.target.value)}
                    rows={2.5}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('errorSolution')}</label>
                  <textarea
                    placeholder={t('howErrorSolved')}
                    value={solution}
                    onChange={(e) => setSolution(e.target.value)}
                    rows={2.5}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('codeBeforeFix')}</label>
                  <textarea
                    placeholder={t('codeBeforeFixPlaceholder')}
                    value={beforeCode}
                    onChange={(e) => setBeforeCode(e.target.value)}
                    rows={4}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs font-mono text-white outline-none focus:border-accent-blue/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('codeAfterFix')}</label>
                  <textarea
                    placeholder={t('codeAfterFixPlaceholder')}
                    value={afterCode}
                    onChange={(e) => setAfterCode(e.target.value)}
                    rows={4}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs font-mono text-white outline-none focus:border-accent-blue/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('tagsCommaSeparated')}</label>
                <input
                  type="text"
                  placeholder="supabase, file-upload, node-js"
                  value={tagsStr}
                  onChange={(e) => setTagsStr(e.target.value)}
                  className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                />
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
                  {submitting ? t('savingSnippet') : t('saveLog')}
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
            placeholder={t('searchErrorsPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-card-bg/40 border border-card-border rounded-2xl py-3 ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'} text-xs text-white placeholder-text-secondary outline-none focus:border-accent-blue/50 transition-colors`}
          />
        </div>

        {/* Layout split */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Left: list cards */}
          <div className="md:col-span-2 space-y-4">
            {loadingErrors ? (
              <SectionSkeleton rows={4} />
            ) : filteredErrors.length > 0 ? (
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
                className="space-y-3"
              >
                {filteredErrors.map((err) => (
                  <motion.div
                    key={err._id}
                    variants={{
                      hidden: { opacity: 0, y: 12 },
                      show: { opacity: 1, y: 0 }
                    }}
                    onClick={() => setSelectedError(err)}
                    className={`p-5 rounded-[24px] border transition-all duration-150 cursor-pointer flex items-center justify-between hover:bg-white/5 ${
                      selectedError?._id === err._id
                        ? 'bg-white/5 border-accent-blue'
                        : 'bg-card-bg/40 border-card-border'
                    }`}
                  >
                    <div className="flex items-start gap-4 max-w-[80%]">
                      <div className="mt-0.5 w-9 h-9 rounded-xl bg-danger/10 flex items-center justify-center flex-shrink-0">
                        <Bug className="w-5 h-5 text-danger" />
                      </div>
                      <div className="flex flex-col ml-3">
                        <h3 className="font-bold text-xs text-white">{err.title}</h3>
                        <p className="text-[10px] text-text-secondary mt-1 line-clamp-1 font-mono">
                          {err.errorMessage}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2.5">
                          {(err.tags || []).slice(0, 3).map((tItem: string) => (
                            <span
                              key={tItem}
                              className="text-[8px] bg-white/5 border border-white/5 px-2 py-0.5 rounded text-text-secondary"
                            >
                              {tItem}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(err._id);
                        }}
                        className="p-1.5 bg-danger/5 hover:bg-danger/15 text-danger rounded-lg transition-colors"
                        title={t('cancel')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className={`w-4 h-4 text-text-secondary ${isRtl ? 'rotate-180' : ''}`} />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="py-20 text-center text-xs text-text-secondary flex flex-col items-center justify-center space-y-4 bg-card-bg/25 border border-card-border rounded-[28px]">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                  <Bug className="w-5 h-5 text-danger" />
                </div>
                <span>{t('noErrorsText')}</span>
              </div>
            )}
          </div>

          {/* Right: Drawer Details with before/after diff code checks */}
          <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass flex flex-col min-h-[400px] overflow-hidden">
            <AnimatePresence mode="wait">
              {selectedError ? (
                <motion.div
                  key={selectedError._id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5 flex-1 flex flex-col justify-between"
                >
                <div>
                  <h3 className="font-bold text-sm text-white mb-2">{selectedError.title}</h3>
                  <div className="text-[9px] font-mono bg-danger/10 border border-danger/15 p-2 rounded-xl text-danger max-h-[80px] overflow-y-auto mb-4" dir="ltr">
                    {selectedError.errorMessage}
                  </div>

                  <div className="space-y-3.5">
                    <div className="space-y-1">
                      <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold">{t('errorCause')}</span>
                      <p className="text-xs text-text-secondary leading-relaxed bg-white/5 p-3 rounded-xl">
                        {selectedError.cause}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold">{t('solution')}</span>
                      <p className="text-xs text-text-secondary leading-relaxed bg-success/10 border border-success/15 p-3 rounded-xl">
                        {selectedError.solution}
                      </p>
                    </div>

                    {selectedError.beforeCode && (
                      <div className="space-y-1">
                        <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold">{t('codeFixComparison')}</span>
                        <div className="grid grid-cols-1 gap-2.5">
                          <pre className="p-2.5 bg-danger/5 border border-danger/10 rounded-xl overflow-x-auto text-[9px] font-mono text-[#FF8585] max-h-[100px]" dir="ltr">
                            <code>{selectedError.beforeCode}</code>
                          </pre>
                          {selectedError.afterCode && (
                            <pre className="p-2.5 bg-success/5 border border-success/10 rounded-xl overflow-x-auto text-[9px] font-mono text-[#85FF85] max-h-[100px]" dir="ltr">
                              <code>{selectedError.afterCode}</code>
                            </pre>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="py-20 text-center text-xs text-text-secondary flex flex-col items-center justify-center space-y-3 h-full justify-center">
                <Info className="w-5 h-5 text-accent-blue opacity-50" />
                <span>{t('chooseErrorToPreview')}</span>
              </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.main>

      <CommandPalette />
    </div>
  );
}

export default function ErrorsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-primary" />}>
      <ErrorsPageContent />
    </Suspense>
  );
}
