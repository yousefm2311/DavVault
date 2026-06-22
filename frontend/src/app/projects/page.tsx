'use client';

import React, { Suspense, useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { AppPageSkeleton, SectionSkeleton } from '@/components/LoadingStates';
import io from 'socket.io-client';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FolderCode,
  HardDrive,
  Upload,
  Plus,
  Search,
  Trash2,
  FileArchive,
  X
} from 'lucide-react';

interface ProjectUploadStatus {
  projectId: string;
  status: 'pending' | 'extracting' | 'parsing' | 'embedding' | 'completed' | 'failed';
  progress: number;
  message: string;
}

interface ProjectItem {
  _id: string;
  name: string;
  description?: string;
  language?: string;
  framework?: string;
  database?: string;
  architectureType?: string;
  healthScore?: number;
  createdAt?: string;
  uploadedAt?: string;
}

const MAX_ZIP_SIZE = 50 * 1024 * 1024;

const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const getHealthTone = (score = 100) => {
  if (score >= 90) return 'bg-success/10 text-success border-success/20';
  if (score >= 70) return 'bg-warning/10 text-warning border-warning/20';
  return 'bg-danger/10 text-danger border-danger/20';
};

const statusSteps: ProjectUploadStatus['status'][] = ['pending', 'extracting', 'parsing', 'embedding', 'completed'];

function ProjectsPageContent() {
  const { user, loading, apiFetch } = useAuth();
  const { t, dir } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectQuery, setProjectQuery] = useState('');
  const [sortMode, setSortMode] = useState<'recent' | 'name' | 'health'>('recent');

  // Upload Form State
  const [showUpload, setShowUpload] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Socket progress states
  const [activeJob, setActiveJob] = useState<ProjectUploadStatus | null>(null);
  const isRtl = dir === 'rtl';

  const filteredProjects = useMemo(() => {
    const query = projectQuery.trim().toLowerCase();
    const list = projects.filter((project) => {
      if (!query) return true;
      return [project.name, project.description, project.language, project.framework, project.database]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

    return [...list].sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      if (sortMode === 'health') return (b.healthScore || 0) - (a.healthScore || 0);
      return new Date(b.createdAt || b.uploadedAt || 0).getTime() - new Date(a.createdAt || a.uploadedAt || 0).getTime();
    });
  }, [projectQuery, projects, sortMode]);

  const projectStats = useMemo(() => {
    const averageHealth =
      projects.length > 0
        ? Math.round(projects.reduce((sum, project) => sum + (project.healthScore || 0), 0) / projects.length)
        : 0;

    const primaryLanguages = projects.reduce<Record<string, number>>((acc, project) => {
      const language = project.language || 'Generic';
      acc[language] = (acc[language] || 0) + 1;
      return acc;
    }, {});

    const topLanguage = Object.entries(primaryLanguages).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Generic';

    return {
      total: projects.length,
      averageHealth,
      topLanguage,
      active: activeJob && activeJob.status !== 'completed' && activeJob.status !== 'failed' ? 1 : 0,
    };
  }, [activeJob, projects]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

  useEffect(() => {
    if (searchParams.get('action') === 'upload') {
      setShowUpload(true);
    }
  }, [searchParams]);

  const fetchProjects = async () => {
    try {
      const data = await apiFetch('/projects');
      setProjects(data.projects || []);
    } catch (err) {
      console.error('[Projects]: Failed to fetch:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchProjects();
  }, [user]);

  // Connect to Socket.io for active jobs progress
  useEffect(() => {
    if (!activeJob?.projectId || activeJob.status === 'completed' || activeJob.status === 'failed') return;

    const projectId = activeJob.projectId;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5001';
    const socket = io(socketUrl);

    socket.on('connect', () => {
      console.log('[Socket]: Connected to index server, joining room project_' + projectId);
      socket.emit('join_project', projectId);
    });

    // Listen to processing updates
    socket.on('processing_progress', (data: any) => {
      console.log('[Socket]: Progress update:', data);
      setActiveJob(prev => prev ? { ...prev, ...data } : null);

      if (data.status === 'completed' || data.status === 'failed') {
        fetchProjects(); // Reload projects list
        socket.disconnect();
      }
    });

    // Fallback room matching
    socket.on(`project_${projectId}_progress`, (data: any) => {
      setActiveJob(prev => prev ? { ...prev, ...data } : null);
      if (data.status === 'completed' || data.status === 'failed') {
        fetchProjects();
        socket.disconnect();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [activeJob?.projectId]);

  const selectUploadFile = (file?: File) => {
    if (file) {
      const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
      if (!isZip) {
        setUploadError(t('supportedFormatZip'));
        return;
      }
      if (file.size > MAX_ZIP_SIZE) {
        setUploadError(`ZIP is too large. Maximum size is ${formatBytes(MAX_ZIP_SIZE)}.`);
        return;
      }

      setUploadError(null);
      setSelectedFile(file);
      if (!projectName) {
        // Auto-fill project name from ZIP name
        setProjectName(file.name.replace(/\.zip$/i, ''));
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    selectUploadFile(e.target.files?.[0]);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (uploading) return;
    selectUploadFile(event.dataTransfer.files?.[0]);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName || !selectedFile) {
      setUploadError(t('errorProjectZip'));
      return;
    }

    setUploadError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append('name', projectName);
    formData.append('description', projectDesc);
    formData.append('project', selectedFile);

    try {
      const data = await apiFetch('/projects/upload', {
        method: 'POST',
        body: formData,
      });

      // Initialize local progress watcher
      setActiveJob({
        projectId: data.projectId,
        status: 'pending',
        progress: 0,
        message: t('preparingIndexing'),
      });

      // Clear form
      setProjectName('');
      setProjectDesc('');
      setSelectedFile(null);
      setUploadError(null);
      setShowUpload(false);
    } catch (err: any) {
      setUploadError(err.message || t('errorUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(t('confirmDeleteProject'))) {
      return;
    }

    try {
      await apiFetch(`/projects/${id}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(p => p._id !== id));
    } catch (err) {
      console.error('[Projects]: Delete failed:', err);
    }
  };

  if (loading || !user) return <AppPageSkeleton label={t('loadingProjects')} />;

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none" dir={dir}>
      <Sidebar />

      <main className="flex-1 overflow-y-auto px-5 py-6 pb-28 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent-blue/20 bg-accent-blue/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-accent-blue">
              <Activity className="h-3.5 w-3.5" />
              DevVault Indexer
            </div>
            <h2 className="text-3xl font-bold tracking-tight">{t('yourRepositories')}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">{t('manageReposDesc')}</p>
          </div>
          <button
            onClick={() => setShowUpload((value) => !value)}
            className="inline-flex items-center justify-center rounded-2xl bg-accent-blue px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-blue/20 transition hover:bg-accent-blue/90"
          >
            <Plus className={`h-4 w-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
            {t('importProject')}
          </button>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            { label: isRtl ? 'إجمالي المشاريع' : 'Total Projects', value: projectStats.total, icon: FolderCode, tone: 'text-accent-blue' },
            { label: isRtl ? 'متوسط الصحة' : 'Average Health', value: `${projectStats.averageHealth}%`, icon: CheckCircle2, tone: projectStats.averageHealth >= 80 ? 'text-success' : 'text-warning' },
            { label: isRtl ? 'اللغة الأكثر استخدامًا' : 'Top Language', value: projectStats.topLanguage, icon: FileArchive, tone: 'text-warning' },
            { label: isRtl ? 'عمليات جارية' : 'Active Jobs', value: projectStats.active, icon: Clock3, tone: projectStats.active ? 'text-accent-blue' : 'text-text-secondary' },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-[24px] border border-card-border bg-card-bg/40 p-5 glass">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-white/5">
                  <Icon className={`h-5 w-5 ${stat.tone}`} />
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="mt-1 text-[11px] text-text-secondary">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Live Processing progress card */}
        {activeJob && (
          <div className="mb-8 rounded-[28px] border border-accent-blue/25 bg-accent-blue/[0.06] p-6 glass">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-blue/10 animate-pulse">
                <FileArchive className="h-6 w-6 text-accent-blue" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold">{t('indexingCodebase')}</h4>
                    <p className="mt-1 text-xs text-text-secondary">{activeJob.message}</p>
                  </div>
                  <span className="rounded-full bg-accent-blue/10 px-3 py-1 text-xs font-bold text-accent-blue">
                    {activeJob.progress}%
                  </span>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-accent-blue transition-all duration-500"
                    style={{ width: `${activeJob.progress}%` }}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
                  {statusSteps.map((step) => {
                    const currentIndex = statusSteps.indexOf(activeJob.status as ProjectUploadStatus['status']);
                    const stepIndex = statusSteps.indexOf(step);
                    const done = activeJob.status === 'completed' || stepIndex < currentIndex;
                    const active = step === activeJob.status;
                    return (
                      <div
                        key={step}
                        className={`rounded-xl border px-3 py-2 text-[10px] font-semibold capitalize ${
                          done
                            ? 'border-success/20 bg-success/10 text-success'
                            : active
                              ? 'border-accent-blue/30 bg-accent-blue/10 text-accent-blue'
                              : 'border-card-border bg-white/[0.03] text-text-secondary'
                        }`}
                      >
                        {done ? <CheckCircle2 className="mb-1 h-3.5 w-3.5" /> : <Clock3 className="mb-1 h-3.5 w-3.5" />}
                        {step}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Import ZIP Form Panel */}
        {showUpload && (
          <div className="mb-8 rounded-[28px] border border-card-border bg-card-bg/50 p-6 glass">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold">{t('importZipProject')}</h3>
                <p className="mt-1 text-xs text-text-secondary">
                  {isRtl ? 'ارفع ملف ZIP وسيتم فهرسة الملفات والعلاقات تلقائيًا.' : 'Upload a ZIP and DevVault will index files, code entities, and relationships automatically.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="rounded-xl p-2 text-text-secondary transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {uploadError && (
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-danger/25 bg-danger/10 p-3.5 text-xs font-medium text-danger">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1.5">
                  <p>{uploadError}</p>
                {uploadError.toLowerCase().includes('limit') && (
                  <Link href="/billing">
                    <span className="text-accent-blue hover:underline font-bold block cursor-pointer">
                      {t('viewPlansAndUpgrade')}
                    </span>
                  </Link>
                )}
                </div>
              </div>
            )}
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('projectName')}</label>
                  <input
                    type="text"
                    placeholder="e.g. ecommerce-api"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    disabled={uploading}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">{t('description')}</label>
                  <input
                    type="text"
                    placeholder={t('optionalDetails')}
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    disabled={uploading}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                  />
                </div>
              </div>

              {/* File selection box */}
              <div
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`relative cursor-pointer rounded-[24px] border-2 border-dashed p-8 text-center transition-colors ${
                  dragActive || selectedFile
                    ? 'border-accent-blue/50 bg-accent-blue/10'
                    : 'border-card-border/70 bg-bg-primary/20 hover:border-accent-blue/40'
                }`}
              >
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  required
                />
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/5 bg-white/5">
                    <Upload className="h-6 w-6 text-accent-blue" />
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {selectedFile ? selectedFile.name : t('clickToChooseZip')}
                  </span>
                  <span className="text-[11px] text-text-secondary">
                    {selectedFile ? formatBytes(selectedFile.size) : `${t('supportedFormatZip')} • Max ${formatBytes(MAX_ZIP_SIZE)}`}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  disabled={uploading}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-semibold cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="px-5 py-2.5 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-accent-blue/50 text-white rounded-2xl text-xs font-semibold cursor-pointer"
                >
                  {uploading ? t('uploadingZip') : t('startIndexing')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Projects Listing */}
        <div className="rounded-[28px] border border-card-border bg-card-bg/40 p-5 glass">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className={`absolute top-3.5 h-4 w-4 text-text-secondary ${isRtl ? 'right-4' : 'left-4'}`} />
              <input
                value={projectQuery}
                onChange={(event) => setProjectQuery(event.target.value)}
                placeholder={isRtl ? 'ابحث باسم المشروع أو التقنية...' : 'Search by project, language, or framework...'}
                className={`w-full rounded-2xl border border-card-border bg-bg-primary/45 py-3 text-sm text-white outline-none transition focus:border-accent-blue/50 ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'}`}
              />
            </div>
            <div className="flex rounded-2xl border border-card-border bg-bg-primary/45 p-1">
              {[
                { key: 'recent', label: isRtl ? 'الأحدث' : 'Recent' },
                { key: 'name', label: isRtl ? 'الاسم' : 'Name' },
                { key: 'health', label: isRtl ? 'الصحة' : 'Health' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSortMode(item.key as typeof sortMode)}
                  className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
                    sortMode === item.key ? 'bg-accent-blue text-white' : 'text-text-secondary hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {loadingProjects ? (
            <SectionSkeleton rows={4} className="border-0 bg-transparent p-0" />
          ) : filteredProjects.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredProjects.map((p) => (
                <div
                  key={p._id}
                  onClick={() => router.push(`/projects/${p._id}`)}
                  className="group relative flex min-h-[210px] cursor-pointer flex-col justify-between overflow-hidden rounded-[24px] border border-white/5 bg-white/[0.04] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-blue/35 hover:bg-white/[0.07]"
                >
                  <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-accent-blue/10 blur-3xl transition group-hover:bg-accent-blue/20" />
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-blue/15">
                          <FolderCode className="h-5 w-5 text-accent-blue" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-white">{p.name}</h3>
                          <p className="mt-1 text-[10px] font-mono text-text-secondary">
                            {p.language || 'Generic'} / {p.framework || 'Vanilla'}
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => handleDeleteProject(e, p._id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 bg-danger/10 hover:bg-danger/25 text-danger rounded-lg transition-all"
                        title={t('cancel')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="mt-4 line-clamp-3 text-xs leading-relaxed text-text-secondary">
                      {p.description || t('noDescription')}
                    </p>
                  </div>

                  <div className="mt-5 space-y-4 border-t border-card-border/40 pt-4">
                    <div className="flex items-center justify-between text-[10px] text-text-secondary">
                      <span className="inline-flex items-center gap-1.5">
                        <HardDrive className="h-3.5 w-3.5 text-accent-blue" />
                        {p.database || 'No DB detected'}
                      </span>
                      <span>{p.architectureType || 'Codebase'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${getHealthTone(p.healthScore || 100)}`}>
                      {t('health')} {p.healthScore || 100}%
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent-blue opacity-0 transition group-hover:opacity-100">
                      {isRtl ? 'فتح التفاصيل' : 'Open details'}
                      <ArrowRight className={`h-3.5 w-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                    </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-xs text-text-secondary flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
                <Upload className="w-6 h-6 text-accent-blue" />
              </div>
              <div className="flex flex-col space-y-1">
                <span className="text-white font-medium">{t('noProjectsImportedYet')}</span>
                <span>{t('noProjectsImportedDesc')}</span>
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

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-primary" />}>
      <ProjectsPageContent />
    </Suspense>
  );
}
