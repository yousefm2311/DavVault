'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import {
  Boxes,
  Plus,
  Trash2,
  Layers,
  ChevronRight,
  BookOpen,
  Info,
  PlayCircle,
  Cpu
} from 'lucide-react';

export default function ReusableSystemsPage() {
  const { user, loading, apiFetch } = useAuth();
  const router = useRouter();

  const [systems, setSystems] = useState<any[]>([]);
  const [loadingSystems, setLoadingSystems] = useState(true);

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

  // Selected system for drawer preview
  const [selectedSystem, setSelectedSystem] = useState<any | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

  const fetchSystems = async () => {
    try {
      const data = await apiFetch('/systems');
      setSystems(data.systems || []);
    } catch (err) {
      console.error('[Systems]: Fetch failed:', err);
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
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reusable system template?')) return;
    try {
      await apiFetch(`/systems/${id}`, { method: 'DELETE' });
      setSystems(prev => prev.filter(s => s._id !== id));
      if (selectedSystem?._id === id) setSelectedSystem(null);
    } catch (err) {
      console.error('[Systems]: Delete failed:', err);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none">
      <Sidebar />

      <main className="flex-1 p-10 overflow-y-auto max-w-5xl mx-auto flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Reusable Systems</h2>
            <p className="text-xs text-text-secondary mt-1">Modular architectural layouts and boilerplates</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center px-4 py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-xs font-semibold rounded-2xl transition-all shadow-md shadow-accent-blue/10 cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add System
          </button>
        </div>

        {/* Add System Form */}
        {showForm && (
          <div className="mb-8 bg-card-bg/60 border border-card-border p-6 rounded-[28px] glass">
            <h3 className="font-bold text-sm mb-4">Define reusable system blueprint</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">System Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Firebase Auth & Role RBAC"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                  >
                    <option value="Authentication">Authentication</option>
                    <option value="Payments">Payments & Billing</option>
                    <option value="File Upload">Upload & S3/Supabase Storage</option>
                    <option value="Database">Database Schema</option>
                    <option value="Notification">Notification Dispatcher</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Description</label>
                <textarea
                  placeholder="Describe the system workflow"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Related Files (comma separated)</label>
                  <input
                    type="text"
                    placeholder="auth.ts, user.model.ts"
                    value={relatedFilesStr}
                    onChange={(e) => setRelatedFilesStr(e.target.value)}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Setup Steps (comma separated)</label>
                  <input
                    type="text"
                    placeholder="npm install, configure .env"
                    value={setupStepsStr}
                    onChange={(e) => setSetupStepsStr(e.target.value)}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Dependencies (comma separated)</label>
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
                <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Flowchart / Code snippet</label>
                <textarea
                  placeholder="Code configuration or setup boilerplate instructions"
                  value={flow}
                  onChange={(e) => setFlow(e.target.value)}
                  rows={4}
                  className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs font-mono text-white outline-none focus:border-accent-blue/50"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-accent-blue/50 text-white rounded-2xl text-xs font-semibold"
                >
                  {submitting ? 'Saving blueprint...' : 'Save Blueprint'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Catalog layout */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Systems grid (2/3 width) */}
          <div className="md:col-span-2 space-y-4">
            {loadingSystems ? (
              <div className="py-20 flex justify-center bg-card-bg/25 border border-card-border rounded-[28px]">
                <div className="w-5 h-5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
              </div>
            ) : systems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {systems.map((sys) => (
                  <div
                    key={sys._id}
                    onClick={() => setSelectedSystem(sys)}
                    className={`p-5 rounded-[24px] border transition-all duration-150 cursor-pointer flex flex-col justify-between h-[150px] hover:bg-white/5 ${
                      selectedSystem?._id === sys._id
                        ? 'bg-white/5 border-accent-blue'
                        : 'bg-card-bg/40 border-card-border'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center">
                            <Layers className="w-4 h-4 text-accent-blue" />
                          </div>
                          <h3 className="font-bold text-xs text-white max-w-[130px] truncate">{sys.name}</h3>
                        </div>
                        <span className="text-[8px] font-mono text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded-full uppercase">
                          {sys.type}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-secondary mt-3 line-clamp-2 leading-relaxed">
                        {sys.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-card-border/40">
                      <span className="text-[9px] text-text-secondary font-mono">
                        {sys.dependencies.length} dependencies
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(sys._id);
                        }}
                        className="p-1.5 hover:bg-danger/10 rounded-lg text-text-secondary hover:text-danger"
                        title="Delete system"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center text-xs text-text-secondary flex flex-col items-center justify-center space-y-4 bg-card-bg/25 border border-card-border rounded-[28px]">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                  <Boxes className="w-5 h-5 text-accent-blue" />
                </div>
                <span>No reusable systems registered. Define system components to start.</span>
              </div>
            )}
          </div>

          {/* Details drawer (1/3 width) */}
          <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass min-h-[350px] flex flex-col justify-between select-text">
            {selectedSystem ? (
              <div className="space-y-4 flex-grow flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-white">{selectedSystem.name}</h3>
                    <span className="text-[8px] font-mono text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded-full uppercase">
                      {selectedSystem.type}
                    </span>
                  </div>

                  <p className="text-xs text-text-secondary leading-relaxed p-3 bg-white/5 rounded-xl">
                    {selectedSystem.description}
                  </p>

                  {selectedSystem.dependencies.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold block">Required Dependencies</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedSystem.dependencies.map((d: string) => (
                          <span key={d} className="text-[9px] bg-white/5 border border-white/5 px-2 py-0.5 rounded text-text-secondary font-mono">
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedSystem.setupSteps.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold block">Setup Instructions</span>
                      <div className="space-y-1.5">
                        {selectedSystem.setupSteps.map((step: string, idx: number) => (
                          <div key={idx} className="flex items-start space-x-2 text-[11px] text-text-secondary">
                            <span className="font-mono text-accent-blue font-bold">{idx + 1}.</span>
                            <span className="leading-normal">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedSystem.flow && (
                    <div className="space-y-1">
                      <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold block">System Flowchart / Config</span>
                      <pre className="p-3 bg-bg-primary rounded-xl overflow-x-auto text-[10px] font-mono text-[#E0E0E0] max-h-[140px]">
                        <code>{selectedSystem.flow}</code>
                      </pre>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => router.push(`/chat?ask=${encodeURIComponent(`Explain setup steps for Reusable System: ${selectedSystem.name}`)}`)}
                  className="w-full py-3 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-2xl text-xs font-semibold transition-colors cursor-pointer flex justify-center items-center mt-3"
                >
                  <Cpu className="w-4 h-4 mr-1.5 animate-pulse" />
                  Generate Instance
                </button>
              </div>
            ) : (
              <div className="py-20 text-center text-xs text-text-secondary flex flex-col items-center justify-center space-y-3 h-full justify-center">
                <Info className="w-5 h-5 text-accent-blue opacity-50" />
                <span>Select a reusable system blueprint to check file maps, dependency modules, and setup scripts.</span>
              </div>
            )}
          </div>
        </div>
      </main>

      <CommandPalette />
    </div>
  );
}
