'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { AppPageSkeleton, SectionSkeleton } from '@/components/LoadingStates';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import {
  Boxes,
  Plus,
  Trash2,
  Layers,
  Info,
  Cpu
} from 'lucide-react';

const isValidObjectIdString = (value?: string) => (
  typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value)
);

export default function ReusableSystemsPage() {
  const { user, loading, apiFetch } = useAuth();
  const { t, dir } = useLanguage();
  const router = useRouter();

  const [systems, setSystems] = useState<any[]>([]);
  const [loadingSystems, setLoadingSystems] = useState(true);
  const [systemsError, setSystemsError] = useState('');

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Authentication');
  const [relatedFilesStr, setRelatedFilesStr] = useState('');
  const [setupStepsStr, setSetupStepsStr] = useState('');
  const [dependenciesStr, setDependenciesStr] = useState('');
  const [flow, setFlow] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Selected system for drawer preview
  const [selectedSystem, setSelectedSystem] = useState<any | null>(null);
  const isRtl = dir === 'rtl';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

  const fetchSystems = async () => {
    try {
      setLoadingSystems(true);
      setSystemsError('');
      const data = await apiFetch('/systems');
      setSystems(data.systems || []);
      const requestedId = new URLSearchParams(window.location.search).get('id');
      if (requestedId) {
        const found = isValidObjectIdString(requestedId)
          ? (data.systems || []).find((item: any) => item._id === requestedId)
          : null;
        setSelectedSystem(found || null);
      }
    } catch (err) {
      console.error('[Systems]: Fetch failed:', err);
      setSystemsError(err instanceof Error ? err.message : 'Unable to load reusable systems.');
    } finally {
      setLoadingSystems(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchSystems();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description || !type) return;

    setSubmitting(true);
    const relatedFiles = relatedFilesStr.split(',').map(f => f.trim()).filter(f => f !== '');
    const setupSteps = setupStepsStr.split(',').map(s => s.trim()).filter(s => s !== '');
    const dependencies = dependenciesStr.split(',').map(d => d.trim()).filter(d => d !== '');

    try {
      setSystemsError('');
      const data = await apiFetch('/systems', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          type,
          relatedFiles,
          setupSteps,
          dependencies,
          flow,
        }),
      });

      setSystems(prev => [data.system, ...prev]);
      setShowForm(false);
      setName('');
      setDescription('');
      setType('Authentication');
      setRelatedFilesStr('');
      setSetupStepsStr('');
      setDependenciesStr('');
      setFlow('');
    } catch (err) {
      console.error('[Systems]: Save failed:', err);
      setSystemsError(err instanceof Error ? err.message : 'Unable to save reusable system.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isValidObjectIdString(id)) {
      setSystemsError('Unable to delete reusable system: invalid id.');
      return;
    }
    if (!confirm(t('deleteSystemConfirm'))) return;
    setDeletingId(id);
    try {
      setSystemsError('');
      await apiFetch(`/systems/${id}`, { method: 'DELETE' });
      setSystems(prev => prev.filter(s => s._id !== id));
      if (selectedSystem?._id === id) setSelectedSystem(null);
    } catch (err) {
      console.error('[Systems]: Delete failed:', err);
      setSystemsError(err instanceof Error ? err.message : 'Unable to delete reusable system.');
    } finally {
      setDeletingId(null);
    }
  };

  const getSystemTypeName = (sysType: string) => {
    if (sysType === 'Authentication') return t('typeAuth');
    if (sysType === 'Payments') return t('typePayments');
    if (sysType === 'File Upload') return t('typeFileUpload');
    if (sysType === 'Database') return t('typeDatabase');
    if (sysType === 'Notification') return t('typeNotification');
    return sysType;
  };

  const renderDependenciesCount = (sys: any) => {
    const count = (sys.dependencies || []).length;
    const template = t('dependenciesCount', { count: 'COUNT' });
    const parts = template.split('COUNT');
    return (
      <span className="text-[9px] text-text-secondary font-mono">
        {parts[0]}<AnimatedCounter value={count} />{parts[1]}
      </span>
    );
  };

  if (loading || !user) return <AppPageSkeleton label={t('loadingSystems')} />;

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
            <h2 className="text-2xl font-bold tracking-tight">{t('systemsTitle')}</h2>
            <p className="text-xs text-text-secondary mt-1">{t('systemsSubtitle')}</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center px-4 py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-xs font-semibold rounded-2xl transition-all shadow-md shadow-accent-blue/10 cursor-pointer"
          >
            <Plus className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
            {t('addSystem')}
          </button>
        </div>

        {/* Add System Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-8 bg-card-bg/60 border border-card-border p-6 rounded-[28px] glass overflow-hidden"
            >
              <h3 className="font-bold text-sm mb-4">{t('defineSystemTemplate')}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('systemName')}</label>
                    <input
                      type="text"
                      placeholder={t('exampleSystemName')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('systemType')}</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none"
                    >
                      <option value="Authentication">{t('typeAuth')}</option>
                      <option value="Payments">{t('typePayments')}</option>
                      <option value="File Upload">{t('typeFileUpload')}</option>
                      <option value="Database">{t('typeDatabase')}</option>
                      <option value="Notification">{t('typeNotification')}</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('systemDescription')}</label>
                  <textarea
                    placeholder={t('describeSystemFunc')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('relatedFilesComma')}</label>
                    <input
                      type="text"
                      placeholder="auth.ts, user.model.ts"
                      value={relatedFilesStr}
                      onChange={(e) => setRelatedFilesStr(e.target.value)}
                      className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('setupStepsComma')}</label>
                    <input
                      type="text"
                      placeholder="npm install, configure .env"
                      value={setupStepsStr}
                      onChange={(e) => setSetupStepsStr(e.target.value)}
                      className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('dependenciesComma')}</label>
                    <input
                      type="text"
                      placeholder="jsonwebtoken, bcryptjs"
                      value={dependenciesStr}
                      onChange={(e) => setDependenciesStr(e.target.value)}
                      className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('flowchartSetupCode')}</label>
                  <textarea
                    placeholder={t('setupInstructionsPlaceholder')}
                    value={flow}
                    onChange={(e) => setFlow(e.target.value)}
                    rows={4}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs font-mono text-white outline-none focus:border-accent-blue/50"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-semibold"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-accent-blue/50 text-white rounded-2xl text-xs font-semibold"
                  >
                    {submitting ? t('savingSystemTemplate') : t('saveSystemTemplate')}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {systemsError && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-xs text-danger">
            <span>{systemsError}</span>
            <button type="button" onClick={fetchSystems} className="rounded-xl border border-danger/20 px-3 py-1 text-[10px] font-semibold">
              Retry
            </button>
          </div>
        )}

        {/* Catalog layout */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Systems grid (2/3 width) */}
          <div className="md:col-span-2 space-y-4">
            {loadingSystems ? (
              <SectionSkeleton rows={4} />
            ) : systems.length > 0 ? (
              <motion.div
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.1
                    }
                  }
                }}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                {systems.map((sys) => (
                  <motion.div
                    key={sys._id}
                    variants={{
                      hidden: { opacity: 0, y: 15 },
                      show: { opacity: 1, y: 0 }
                    }}
                    onClick={() => setSelectedSystem(sys)}
                    className={`p-5 rounded-[24px] border transition-all duration-150 cursor-pointer flex flex-col justify-between h-[150px] hover:bg-white/5 ${
                      selectedSystem?._id === sys._id
                        ? 'bg-white/5 border-accent-blue'
                        : 'bg-card-bg/40 border-card-border'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center">
                            <Layers className="w-4 h-4 text-accent-blue" />
                          </div>
                          <h3 className="font-bold text-xs text-white max-w-[130px] truncate">{sys.name}</h3>
                        </div>
                        <span className="text-[8px] font-mono text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded-full uppercase text-nowrap">
                          {getSystemTypeName(sys.type)}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-secondary mt-3 line-clamp-2 leading-relaxed">
                        {sys.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-card-border/40">
                      {renderDependenciesCount(sys)}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(sys._id);
                        }}
                        disabled={deletingId === sys._id}
                        className="p-1.5 hover:bg-danger/10 rounded-lg text-text-secondary hover:text-danger"
                        title={t('cancel')}
                      >
                        {deletingId === sys._id ? (
                          <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-danger animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="py-20 text-center text-xs text-text-secondary flex flex-col items-center justify-center space-y-4 bg-card-bg/25 border border-card-border rounded-[28px]">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                  <Boxes className="w-5 h-5 text-accent-blue" />
                </div>
                <span>{t('noSystemsText')}</span>
              </div>
            )}
          </div>

          {/* Details drawer (1/3 width) */}
          <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass min-h-[350px] flex flex-col justify-between select-text overflow-hidden">
            <AnimatePresence mode="wait">
              {selectedSystem ? (
                <motion.div
                  key={selectedSystem._id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4 flex-grow flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-white">{selectedSystem.name}</h3>
                      <span className="text-[8px] font-mono text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded-full uppercase">
                        {getSystemTypeName(selectedSystem.type)}
                      </span>
                    </div>

                    <p className="text-xs text-text-secondary leading-relaxed p-3 bg-white/5 rounded-xl">
                      {selectedSystem.description}
                    </p>

                    {(selectedSystem.dependencies || []).length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold block">{t('requiredDependencies')}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {(selectedSystem.dependencies || []).map((d: string) => (
                            <span key={d} className="text-[9px] bg-white/5 border border-white/5 px-2 py-0.5 rounded text-text-secondary font-mono">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {(selectedSystem.setupSteps || []).length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold block">{t('setupInstructions')}</span>
                        <div className="space-y-1.5">
                          {(selectedSystem.setupSteps || []).map((step: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 text-[11px] text-text-secondary">
                              <span className="font-mono text-accent-blue font-bold">{idx + 1}.</span>
                              <span className="leading-normal">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedSystem.flow && (
                      <div className="space-y-1">
                        <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold block">{t('systemFlowchart')}</span>
                        <pre className="p-3 bg-bg-primary rounded-xl overflow-x-auto text-[10px] font-mono text-[#E0E0E0] max-h-[140px]" dir="ltr">
                          <code>{selectedSystem.flow}</code>
                        </pre>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => router.push(`/chat?ask=${encodeURIComponent(`Explain steps to configure reusable system: ${selectedSystem.name}`)}`)}
                    className="w-full py-3 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-2xl text-xs font-semibold transition-colors cursor-pointer flex justify-center items-center mt-3"
                  >
                    <Cpu className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'} animate-pulse`} />
                    {t('generateInstance')}
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
                  <Info className="w-5 h-5 text-accent-blue" />
                  <span>{t('chooseSystemToPreview')}</span>
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
