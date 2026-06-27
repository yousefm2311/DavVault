'use client';

import React, { Suspense, useMemo, useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { AppPageSkeleton } from '@/components/LoadingStates';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import Editor from '@monaco-editor/react';
import ReactFlow, { Background, Controls, MiniMap, Node, Edge, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  FolderCode,
  FileCode,
  Search,
  RefreshCw,
  Sparkles,
  Layers,
  Heart,
  MessageSquare,
  Folder,
  Play,
  Copy,
  Check,
  Clock,
  User,
  GitBranch,
  Database,
  Code2,
  ShieldCheck,
  Maximize2,
  Trash2,
  Download
} from 'lucide-react';

interface FileNode {
  _id: string;
  path: string;
  fileName: string;
  extension: string;
  size: number;
  summary?: string;
  language?: string;
}

const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const getMonacoLanguage = (file?: Partial<FileNode>) => {
  const language = file?.language?.toLowerCase();
  const ext = file?.extension?.replace('.', '').toLowerCase();
  if (language === 'dart' || ext === 'dart') return 'dart';
  if (language === 'python' || ext === 'py') return 'python';
  if (language === 'typescript' || ext === 'ts' || ext === 'tsx') return 'typescript';
  if (language === 'json' || ext === 'json') return 'json';
  if (language === 'css' || ext === 'css' || ext === 'scss') return 'css';
  if (language === 'html' || ext === 'html') return 'html';
  return 'javascript';
};

const getHealthTone = (score = 100) => {
  if (score >= 90) return 'text-success bg-success/10 border-success/20';
  if (score >= 70) return 'text-warning bg-warning/10 border-warning/20';
  return 'text-danger bg-danger/10 border-danger/20';
};

// Custom file tree node component helper
const FileTreeItem: React.FC<{
  name: string;
  isFolder: boolean;
  isOpen?: boolean;
  onClick: () => void;
  depth: number;
  isRtl?: boolean;
  active?: boolean;
}> = ({ name, isFolder, isOpen, onClick, depth, isRtl, active }) => {
  return (
    <div
      onClick={onClick}
      style={{
        paddingRight: isRtl ? `${depth * 14 + 10}px` : '10px',
        paddingLeft: isRtl ? '10px' : `${depth * 14 + 10}px`
      }}
      className={`flex items-center gap-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs ${
        active ? 'bg-accent-blue/10 text-white' : 'text-text-secondary hover:bg-white/5 hover:text-white'
      } ${isRtl ? 'text-right' : 'text-left'}`}
    >
      {isFolder ? (
        <Folder className={`w-3.5 h-3.5 text-accent-blue ${isOpen ? 'opacity-90' : 'opacity-60'}`} />
      ) : (
        <FileCode className="w-3.5 h-3.5 text-text-secondary opacity-70" />
      )}
      <span className="truncate">{name}</span>
    </div>
  );
};

// Custom React Flow node component
const CustomFileNode = ({ data }: any) => {
  return (
    <div className="min-w-[210px] rounded-2xl border border-accent-blue/35 bg-card-bg/95 px-4 py-3 text-left shadow-lg shadow-accent-blue/5 glass transition-colors duration-200 hover:border-accent-blue">
      <Handle type="target" position={Position.Top} className="!bg-accent-blue !w-2 !h-2" />
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center shrink-0">
          <FileCode className="w-4 h-4 text-accent-blue" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-white truncate block">{data.label}</span>
          <span className="text-[9px] text-text-secondary truncate block font-mono mt-0.5">{data.path}</span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-card-border/50 pt-2">
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-mono text-text-secondary">
          {data.language || data.extension || 'file'}
        </span>
        <span className="text-[9px] font-mono text-text-muted">{formatBytes(data.size || 0)}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-accent-blue !w-2 !h-2" />
    </div>
  );
};

function ProjectDetailsPageContent({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { id } = params;
  const { user, loading, apiFetch, accessToken } = useAuth();
  const { t, dir } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const nodeTypes = useMemo(() => ({
    fileNode: CustomFileNode,
  }), []);

  // Selected tab
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'chat' | 'graph' | 'replay'>('overview');
  const [replayTimeline, setReplayTimeline] = useState<any[]>([]);

  const [project, setProject] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loadingProject, setLoadingProject] = useState(true);

  // File tree states
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [selectedFileContent, setSelectedFileContent] = useState('');
  const [loadingFileContent, setLoadingFileContent] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [fileQuery, setFileQuery] = useState('');

  // AI explanation state
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  // Scoped chat states
  const [projectMessages, setProjectMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // React Flow graph states
  const [graphNodes, setGraphNodes] = useState<Node[]>([]);
  const [graphEdges, setGraphEdges] = useState<Edge[]>([]);
  const [selectedGraphNode, setSelectedGraphNode] = useState<Node | null>(null);

  // Code Copy state
  const [codeCopied, setCodeCopied] = useState(false);
  const isRtl = dir === 'rtl';

  const filteredFiles = useMemo(() => {
    const query = fileQuery.trim().toLowerCase();
    if (!query) return files;
    return files.filter((file) =>
      [file.path, file.fileName, file.extension, file.language, file.summary]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [fileQuery, files]);

  const fileStats = useMemo(() => {
    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    const languageCounts = files.reduce<Record<string, number>>((acc, file) => {
      const key = file.language || file.extension || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const topLanguages = Object.entries(languageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return { totalSize, topLanguages };
  }, [files]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

  const loadProjectDetails = async () => {
    try {
      const [overviewData, filesData, graphData, replayData, healthData] = await Promise.all([
        apiFetch(`/projects/${id}/overview`),
        apiFetch(`/projects/${id}/files`),
        apiFetch(`/projects/${id}/graph`),
        apiFetch(`/ai-extensions/projects/${id}/replay`),
        apiFetch(`/projects/${id}/health`),
      ]);

      setProject({ ...overviewData.project, healthScore: healthData.healthScore });
      setStats(overviewData.stats);
      setFiles(filesData.files || []);
      setReplayTimeline(replayData.timeline || []);

      // Format React Flow Nodes and Edges
      setGraphNodes((graphData.nodes || []).map((node: Node) => ({
        ...node,
        data: {
          ...(node.data || {}),
        },
      })));
      setGraphEdges((graphData.edges || []).map((edge: Edge) => ({
        ...edge,
        animated: true,
        label: edge.label,
        style: { stroke: '#9DBDFF', strokeWidth: 1.8, opacity: 0.78, ...(edge.style || {}) },
        labelStyle: { fill: '#A1A1AA', fontSize: 10, fontWeight: 700 },
        labelBgStyle: { fill: 'rgba(28,28,30,0.9)' },
      })));

      // If fileId is specified in URL query params
      const urlFileId = searchParams.get('fileId');
      if (urlFileId && filesData.files) {
        const found = filesData.files.find((f: any) => f._id === urlFileId);
        if (found) {
          handleFileSelect(found);
          setActiveTab('files');
        }
      }
    } catch (err) {
      console.error('[ProjectDetail]: Load failed:', err);
    } finally {
      setLoadingProject(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadProjectDetails();
  }, [user, id]);

  useEffect(() => {
    if (fileQuery.trim()) {
      expandAllFolders();
    }
  }, [fileQuery]);

  async function handleFileSelect(file: FileNode) {
    setSelectedFile(file);
    setLoadingFileContent(true);
    setExplanation(null);
    try {
      const data = await apiFetch(`/projects/${id}/files/${file._id}`);
      setSelectedFileContent(data.content);
    } catch (err) {
      console.error('[ProjectDetail]: File load failed:', err);
    } finally {
      setLoadingFileContent(false);
    }
  }

  const handleExplainCode = async () => {
    if (!selectedFile || !selectedFileContent || loadingExplanation) return;
    setLoadingExplanation(true);
    try {
      const data = await apiFetch('/ai/explain-code', {
        method: 'POST',
        body: JSON.stringify({
          code: selectedFileContent,
          fileName: selectedFile.fileName,
          language: selectedFile.language,
        }),
      });
      setExplanation(data.explanation);
    } catch (err) {
      console.error('[ProjectDetail]: Explain failed:', err);
    } finally {
      setLoadingExplanation(false);
    }
  };

  const handleSendProjectChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || sendingChat) return;

    const msgText = chatInput;
    setChatInput('');
    setSendingChat(true);

    setProjectMessages(prev => [...prev, { sender: 'user', text: msgText }]);

    try {
      const data = await apiFetch('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: msgText,
          projectId: id,
        }),
      });

      setProjectMessages(prev => [
        ...prev,
        { sender: 'assistant', text: data.answer, citations: data.citations || [] },
      ]);
    } catch (err) {
      console.error('[ProjectDetail/Chat]: Message failed:', err);
    } finally {
      setSendingChat(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm(t('confirmDeleteProject'))) {
      return;
    }
    try {
      await apiFetch(`/projects/${id}`, { method: 'DELETE' });
      router.push('/projects');
    } catch (err) {
      console.error('[ProjectDetail]: Delete failed:', err);
    }
  };

  const handleDownloadZip = async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
      const res = await fetch(`${apiBase}/projects/${id}/download`, {
        credentials: 'include',
        headers: {
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        }
      });
      if (!res.ok) {
        alert('Failed to download project files');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name || 'project'}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download project zip');
    }
  };

  const handleCopyCode = () => {
    if (!selectedFileContent) return;
    navigator.clipboard.writeText(selectedFileContent);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1500);
  };

  // Helper: Build File Tree from Flat paths list
  const buildFileTree = (sourceFiles: FileNode[]) => {
    const root: any = {};
    sourceFiles.forEach(f => {
      const parts = f.path.split('/');
      let current = root;
      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = index === parts.length - 1 ? { _file: f } : {};
        }
        current = current[part];
      });
    });
    return root;
  };

  const expandAllFolders = () => {
    const next: Record<string, boolean> = {};
    files.forEach((file) => {
      const parts = file.path.split('/');
      parts.slice(0, -1).forEach((_, index) => {
        const key = parts.slice(0, index + 1).join('/');
        next[key] = true;
      });
    });
    setExpandedFolders(next);
  };

  const renderFileTreeNodes = (node: any, depth = 0, parentKey = '') => {
    return Object.keys(node).sort().map(key => {
      const item = node[key];
      const nodeKey = parentKey ? `${parentKey}/${key}` : key;
      const isFolder = !item._file;
      const isOpen = expandedFolders[nodeKey];

      if (isFolder) {
        return (
          <div key={nodeKey}>
            <FileTreeItem
              name={key}
              isFolder={true}
              isOpen={isOpen}
              depth={depth}
              isRtl={isRtl}
            onClick={() => setExpandedFolders(prev => ({ ...prev, [nodeKey]: !prev[nodeKey] }))}
            />
            {isOpen && renderFileTreeNodes(item, depth + 1, nodeKey)}
          </div>
        );
      } else {
        return (
          <FileTreeItem
            key={nodeKey}
            name={key}
            isFolder={false}
            depth={depth}
            isRtl={isRtl}
            active={selectedFile?._id === item._file._id}
            onClick={() => handleFileSelect(item._file)}
          />
        );
      }
    });
  };

  if (loading || !user || loadingProject) {
    return <AppPageSkeleton label={t('loadingProjectMetrics')} />;
  }

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none" dir={dir}>
      <Sidebar />

      <main className="flex-1 overflow-hidden h-screen px-5 py-6 lg:px-10 lg:py-8 flex flex-col">
        {/* Project Header details */}
        <div className="flex flex-col gap-4 border-b border-card-border pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-blue/15 ring-1 ring-accent-blue/20">
              <FolderCode className="h-6 w-6 text-accent-blue" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold tracking-tight">{project.name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-text-secondary font-mono">
                <span>{project.language || 'generic'}</span>
                <span>•</span>
                <span>{project.framework || 'vanilla'}</span>
                <span>•</span>
                <span>{project.database || 'none'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Health Score badge */}
            <div className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 glass ${getHealthTone(project.healthScore)}`}>
              <Heart className="w-4 h-4 text-danger animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider font-semibold opacity-80">{t('healthScore')}</span>
                <span className="text-xs font-bold font-mono"><AnimatedCounter value={project.healthScore || 0} />%</span>
              </div>
            </div>
            <button
              onClick={handleDownloadZip}
              className="inline-flex items-center gap-2 rounded-2xl border border-card-border bg-card-bg/50 px-4 py-3 text-xs font-semibold text-accent-blue transition hover:bg-accent-blue/10 hover:text-white cursor-pointer"
            >
              <Download className="h-4 w-4" />
              {t('downloadZip')}
            </button>
            <button
              onClick={loadProjectDetails}
              className="inline-flex items-center gap-2 rounded-2xl border border-card-border bg-card-bg/50 px-4 py-3 text-xs font-semibold text-text-secondary transition hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              {isRtl ? 'تحديث' : 'Refresh'}
            </button>
            <button
              onClick={handleDeleteProject}
              className="inline-flex items-center gap-2 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-xs font-semibold text-danger transition hover:bg-danger/25 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              {t('deleteProjectBtn')}
            </button>
          </div>
        </div>

        {/* Tab Selection Navigation */}
        <div className="my-6 flex w-full max-w-3xl gap-1.5 overflow-x-auto rounded-2xl border border-card-border/60 bg-bg-secondary p-1">
          {(['overview', 'files', 'chat', 'graph', 'replay'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`min-w-[110px] flex-1 rounded-xl px-3 py-2.5 text-center text-xs font-semibold capitalize transition-all cursor-pointer ${
                activeTab === tab ? 'bg-accent-blue text-white shadow-md' : 'text-text-secondary hover:text-white'
              }`}
            >
              {{
                overview: t('overview'),
                files: t('files'),
                chat: t('chat'),
                graph: t('graph'),
                replay: t('replay'),
              }[tab]}
              {tab === 'files' && <span className="ml-1 opacity-70">(<AnimatedCounter value={files.length} />)</span>}
              {tab === 'graph' && <span className="ml-1 opacity-70">(<AnimatedCounter value={graphEdges.length} />)</span>}
            </button>
          ))}
        </div>

        {/* Main tabs components wrapper */}
        <div className="flex-1 overflow-hidden relative">
          {/* 1. Overview Tab */}
          {activeTab === 'overview' && (
            <div className="h-full overflow-y-auto space-y-6 animate-fade-in pr-2 select-text">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {[
                  { label: t('totalFiles'), value: <AnimatedCounter value={stats?.totalFiles || files.length} />, icon: FileCode, tone: 'text-accent-blue' },
                  { label: t('indexedClassesRoutes'), value: <AnimatedCounter value={stats?.totalEntities || 0} />, icon: Code2, tone: 'text-success' },
                  { label: isRtl ? 'حجم المشروع' : 'Project Size', value: formatBytes(stats?.totalSize || fileStats.totalSize), icon: Database, tone: 'text-warning' },
                  { label: isRtl ? 'العلاقات' : 'Relations', value: <AnimatedCounter value={graphEdges.length} />, icon: GitBranch, tone: 'text-accent-blue' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-[24px] border border-card-border bg-card-bg/40 p-5 glass">
                      <Icon className={`mb-5 h-5 w-5 ${item.tone}`} />
                      <p className="text-2xl font-bold">{item.value}</p>
                      <p className="mt-1 text-[11px] text-text-secondary">{item.label}</p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Tech specifications card */}
                <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass space-y-4">
                  <h3 className="flex items-center gap-2 font-bold text-sm">
                    <ShieldCheck className="h-4 w-4 text-accent-blue" />
                    {t('systemProperties')}
                  </h3>
                  <div className="space-y-3.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">{t('language')}</span>
                      <span className="font-semibold text-white font-mono">{project.language || 'generic'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">{t('framework')}</span>
                      <span className="font-semibold text-white font-mono">{project.framework || 'vanilla'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">{t('database')}</span>
                      <span className="font-semibold text-white font-mono">{project.database || 'none'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">{t('totalFiles')}</span>
                      <span className="font-semibold text-white font-mono"><AnimatedCounter value={stats?.totalFiles || 0} /></span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">{t('indexedClassesRoutes')}</span>
                      <span className="font-semibold text-white font-mono"><AnimatedCounter value={stats?.totalEntities || 0} /></span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">{t('projectSize')}</span>
                      <span className="font-semibold text-white font-mono">
                        {formatBytes(stats?.totalSize || fileStats.totalSize)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI Auto-Documentation card (2/3 width) */}
                <div className="md:col-span-2 bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-accent-blue" />
                    <h3 className="font-bold text-sm">{t('aiGeneratedDoc')}</h3>
                  </div>
                  <div className="text-xs text-text-secondary leading-relaxed space-y-3">
                    {project.description && (
                      <p className="rounded-2xl border border-card-border bg-bg-primary/40 p-4 text-white">
                        {project.description}
                      </p>
                    )}
                    <p>
                      {t('frameworkLanguageRecognized', { framework: project.framework || 'Vanilla', language: project.language || 'JavaScript' })} {t('containsFlows')}
                    </p>
                    <h4 className="font-bold text-white pt-2">{t('databaseLayer')}</h4>
                    <p>
                      {t('databaseUsed', { database: project.database || 'in-memory / mock' })}
                    </p>
                    <h4 className="font-bold text-white pt-2">{t('securityAnalysis')}</h4>
                    <p>
                      {t('noSecretsExposed')}
                    </p>
                    {fileStats.topLanguages.length > 0 && (
                      <div className="pt-2">
                        <h4 className="font-bold text-white">{isRtl ? 'توزيع الملفات' : 'File Distribution'}</h4>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {fileStats.topLanguages.map(([language, count]) => (
                            <span key={language} className="rounded-full border border-card-border bg-white/5 px-3 py-1.5 text-[10px] font-semibold text-text-secondary">
                              {language}: {count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Files Explorer & Monaco Viewer Tab */}
          {activeTab === 'files' && (
            <div className="h-full flex overflow-hidden border border-card-border rounded-[28px] bg-bg-secondary animate-fade-in">
              {/* File Tree Left pane */}
              <div className={`w-72 shrink-0 ${isRtl ? 'border-l' : 'border-r'} border-card-border overflow-hidden p-4 select-none flex flex-col`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold px-2 block">
                    {t('workspaceFiles')}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={expandAllFolders}
                      className="rounded-lg px-2 py-1 text-[9px] font-semibold text-text-secondary hover:bg-white/10 hover:text-white"
                    >
                      {isRtl ? 'فتح' : 'Expand'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedFolders({})}
                      className="rounded-lg px-2 py-1 text-[9px] font-semibold text-text-secondary hover:bg-white/10 hover:text-white"
                    >
                      {isRtl ? 'طي' : 'Collapse'}
                    </button>
                  </div>
                </div>
                <div className="relative mb-3">
                  <Search className={`absolute top-3 h-3.5 w-3.5 text-text-secondary ${isRtl ? 'right-3' : 'left-3'}`} />
                  <input
                    value={fileQuery}
                    onChange={(event) => setFileQuery(event.target.value)}
                    placeholder={isRtl ? 'بحث في الملفات...' : 'Search files...'}
                    className={`w-full rounded-xl border border-card-border bg-bg-primary/50 py-2.5 text-[11px] text-white outline-none focus:border-accent-blue/50 ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                  />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto space-y-0.5 pr-1">
                  {filteredFiles.length > 0 ? (
                    renderFileTreeNodes(buildFileTree(filteredFiles))
                  ) : (
                    <div className="py-10 text-center text-[11px] text-text-secondary">
                      {isRtl ? 'لا توجد ملفات مطابقة' : 'No matching files'}
                    </div>
                  )}
                </div>
              </div>

              {/* Monaco Editor Center pane */}
              <div className="flex-1 flex flex-col justify-between bg-bg-primary h-full relative select-text">
                {selectedFile ? (
                  <>
                    {/* Monaco Header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-card-border bg-bg-secondary">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-accent-blue" />
                        <div className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-white">{selectedFile.fileName}</span>
                          <span className="mt-0.5 block truncate text-[9px] font-mono text-text-secondary">
                            {selectedFile.path} • {formatBytes(selectedFile.size)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleExplainCode}
                          disabled={loadingExplanation}
                          className="flex items-center px-3 py-1.5 bg-accent-blue/10 hover:bg-accent-blue/20 text-[10px] font-bold text-accent-blue rounded-xl transition-colors cursor-pointer"
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                          {t('explainCode')}
                        </button>
                        <button
                          onClick={handleCopyCode}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white"
                          title={t('copyCode')}
                        >
                          {codeCopied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Monaco Content */}
                    <div className="flex-1 relative">
                      {loadingFileContent ? (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-text-secondary">
                          <div className="w-5 h-5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin mr-2"></div>
                          {t('loadingFile')}
                        </div>
                      ) : (
                        <Editor
                          height="100%"
                          language={getMonacoLanguage(selectedFile)}
                          theme="vs-dark"
                          value={selectedFileContent}
                          options={{
                            readOnly: true,
                            minimap: { enabled: false },
                            fontSize: 12,
                            fontFamily: 'var(--font-mono)',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                          }}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-xs text-text-secondary space-y-3">
                    <FolderCode className="w-10 h-10 text-accent-blue opacity-50" />
                    <span>{t('chooseFileToPreview')}</span>
                  </div>
                )}
              </div>

              {/* AI Explanation Drawer (Right pane) */}
              {selectedFile && (
                <div className={`w-72 ${isRtl ? 'border-l' : 'border-r'} border-card-border bg-bg-secondary p-5 overflow-y-auto select-text flex flex-col gap-4`}>
                  <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                    {t('aiExplanations')}
                  </span>
                  
                  {loadingExplanation ? (
                    <div className="py-20 flex flex-col items-center justify-center space-y-3 text-xs text-text-secondary">
                      <div className="w-5 h-5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
                      <span>{t('analyzingFileLogic')}</span>
                    </div>
                  ) : explanation ? (
                    <div className="text-xs text-[#E0E0E0] leading-relaxed whitespace-pre-wrap font-sans bg-bg-primary p-4 rounded-2xl border border-card-border">
                      {explanation}
                    </div>
                  ) : selectedFile.summary ? (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="text-[9px] text-text-secondary font-medium tracking-wider uppercase">{t('fileSummary')}</span>
                        <p className="text-xs text-text-secondary leading-relaxed bg-bg-primary p-3.5 rounded-xl border border-card-border">
                          {selectedFile.summary}
                        </p>
                      </div>
                      <button
                        onClick={handleExplainCode}
                        className="w-full py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        {t('deepCodeReview')}
                      </button>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs text-text-secondary">
                      {t('clickExplainToAnalyze')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3. Scoped Project Chat Tab */}
          {activeTab === 'chat' && (
            <div className="h-full flex border border-card-border rounded-[28px] bg-bg-secondary overflow-hidden animate-fade-in">
              <div className="flex-1 flex flex-col justify-between bg-bg-primary h-full">
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {projectMessages.length > 0 ? (
                    projectMessages.map((m, i) => (
                      <div
                        key={i}
                        className={`flex items-start space-x-3 max-w-[80%] ${
                          m.sender === 'user' ? 'ml-auto flex-row-reverse space-x-reverse' : ''
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          m.sender === 'user' ? 'bg-accent-blue/15 text-accent-blue' : 'bg-white/5 border border-white/5 text-success'
                        }`}>
                          {m.sender === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4.5 h-4.5" />}
                        </div>
                        <div className={`p-4 rounded-[22px] text-xs leading-relaxed ${
                          m.sender === 'user' ? 'bg-accent-blue text-white' : 'bg-card-bg/40 border border-card-border text-[#E0E0E0]'
                        }`}>
                          {m.text}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-24 text-center text-xs text-text-secondary flex flex-col items-center justify-center space-y-4 h-full justify-center">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-accent-blue" />
                      </div>
                      <span>{t('askContextOnly', { projectName: project.name })}</span>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSendProjectChat} className="p-5 border-t border-card-border bg-bg-secondary flex gap-3 items-center">
                  <input
                    type="text"
                    placeholder={t('askInProjectFiles', { projectName: project.name })}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={sendingChat}
                    className="flex-1 bg-bg-primary/50 border border-card-border rounded-xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                  />
                  <button
                    type="submit"
                    disabled={sendingChat || !chatInput.trim()}
                    className="p-3 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-xl cursor-pointer"
                  >
                    {sendingChat ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 4. React Flow Graph Tab */}
          {activeTab === 'graph' && (
            <div className="h-full border border-card-border rounded-[28px] overflow-hidden bg-[#080B12] relative animate-fade-in">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(10,132,255,0.22),transparent_28%),radial-gradient(circle_at_80%_70%,rgba(48,209,88,0.12),transparent_24%),linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:100%_100%,100%_100%,30px_30px,30px_30px] pointer-events-none"></div>
              <div className={`absolute top-4 ${isRtl ? 'right-4' : 'left-4'} z-10 max-w-sm rounded-2xl border border-card-border bg-card-bg/90 px-4 py-3 text-[10px] leading-relaxed text-text-secondary shadow-2xl shadow-black/30 glass`}>
                <div className="mb-1 flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-accent-blue" />
                  <span className="font-semibold text-white">{t('graphExplorer')}</span>
                </div>
                <span>{t('graphNodesDesc')}</span>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-accent-blue/10 px-2 py-1 text-accent-blue">
                    {t('nodesCount', { count: 'COUNT' }).split('COUNT').map((part, idx) => (
                      idx === 0 ? <React.Fragment key={idx}>{part}<AnimatedCounter value={graphNodes.length} /></React.Fragment> : part
                    ))}
                  </span>
                  <span className="rounded-full bg-success/10 px-2 py-1 text-success">
                    {t('edgesCount', { count: 'COUNT' }).split('COUNT').map((part, idx) => (
                      idx === 0 ? <React.Fragment key={idx}>{part}<AnimatedCounter value={graphEdges.length} /></React.Fragment> : part
                    ))}
                  </span>
                  <span className="rounded-full bg-white/5 px-2 py-1 text-text-secondary">{isRtl ? 'اضغط على ملف لعرض التفاصيل' : 'Click a file for details'}</span>
                </div>
              </div>
              <div className={`absolute ${isRtl ? 'left-4' : 'right-4'} top-4 z-10 rounded-2xl border border-card-border bg-card-bg/90 px-3 py-2 text-[10px] text-text-secondary glass flex items-center gap-2`}>
                <Maximize2 className="h-3.5 w-3.5 text-accent-blue" />
                {t('graphInteractInstruction')}
              </div>

              {selectedGraphNode && (
                <div className={`absolute bottom-4 ${isRtl ? 'right-4' : 'left-4'} z-10 w-[320px] rounded-2xl border border-card-border bg-card-bg/95 p-4 shadow-2xl shadow-black/40 glass`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-bold text-white">{selectedGraphNode.data?.label}</h4>
                      <p className="mt-1 truncate text-[10px] font-mono text-text-secondary">{selectedGraphNode.data?.path}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedGraphNode(null)}
                      className="rounded-lg px-2 py-1 text-[10px] text-text-secondary hover:bg-white/10 hover:text-white"
                    >
                      {isRtl ? 'إغلاق' : 'Close'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="rounded-xl bg-white/5 p-3">
                      <span className="block text-text-secondary">{isRtl ? 'اللغة' : 'Language'}</span>
                      <strong className="mt-1 block text-white">{selectedGraphNode.data?.language || selectedGraphNode.data?.extension || 'file'}</strong>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <span className="block text-text-secondary">{isRtl ? 'الحجم' : 'Size'}</span>
                      <strong className="mt-1 block text-white">{formatBytes(selectedGraphNode.data?.size || 0)}</strong>
                    </div>
                  </div>
                  {selectedGraphNode.data?.summary && (
                    <p className="mt-3 line-clamp-3 text-[11px] leading-relaxed text-text-secondary">
                      {selectedGraphNode.data.summary}
                    </p>
                  )}
                </div>
              )}
              
              {graphNodes.length > 0 ? (
                <ReactFlow
                  nodes={graphNodes}
                  edges={graphEdges}
                  nodeTypes={nodeTypes}
                  onNodeClick={(_, node) => setSelectedGraphNode(node)}
                  fitView
                  fitViewOptions={{ padding: 0.24 }}
                  minZoom={0.35}
                  maxZoom={1.9}
                  className="relative z-0"
                >
                  <Background color="rgba(157,189,255,0.18)" gap={26} />
                  <MiniMap
                    nodeColor={() => '#0A84FF'}
                    maskColor="rgba(10,10,10,0.66)"
                    className="!bg-card-bg !border !border-card-border !rounded-2xl"
                  />
                  <Controls className="!bg-card-bg !border !border-card-border !text-white !rounded-2xl !shadow-lg fill-white" />
                </ReactFlow>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-xs text-text-secondary space-y-3">
                  <Layers className="w-10 h-10 text-accent-blue opacity-50" />
                  <span>{t('noRelationsExtracted')}</span>
                </div>
              )}
            </div>
          )}

          {/* 5. Project Replay timeline Tab */}
          {activeTab === 'replay' && (
            <div className="h-full overflow-y-auto bg-bg-secondary p-6 rounded-[28px] border border-card-border animate-fade-in pr-2 select-text">
              <h3 className="font-bold text-sm mb-6 flex items-center">
                <Clock className={`w-5 h-5 text-accent-blue ${isRtl ? 'ml-2' : 'mr-2'}`} />
                {t('replayTimeline')}
              </h3>
              {replayTimeline.length > 0 ? (
                <div className={`relative border-r border-card-border pr-6 space-y-6 ${isRtl ? 'mr-3' : 'ml-3'}`}>
                  {replayTimeline.map((item, idx) => (
                    <div key={idx} className="relative group">
                      <div className={`absolute ${isRtl ? '-right-[31px]' : '-left-[31px]'} top-1.5 w-4.5 h-4.5 rounded-full border-4 border-bg-primary bg-accent-blue flex items-center justify-center flex-shrink-0`}></div>
                      <div className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-accent-blue font-bold uppercase tracking-wider bg-accent-blue/10 px-2 py-0.5 rounded-full">
                            {item.day}
                          </span>
                          <span className="text-[10px] text-text-secondary font-semibold">{t('phase')}</span>
                        </div>
                        <h4 className="font-bold text-xs text-white mt-2.5">{item.title}</h4>
                        <p className="text-[11px] text-text-secondary leading-relaxed mt-1">
                          {item.description}
                        </p>
                        {item.files.length > 0 && (
                          <div className="mt-3.5 pt-3.5 border-t border-card-border/45 space-y-1.5">
                            <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold block">{t('relatedFiles')}</span>
                            <div className="flex flex-wrap gap-2">
                              {item.files.map((filePath: string) => {
                                const matchedFile = files.find(f => f.path === filePath);
                                return (
                                  <div
                                    key={filePath}
                                    onClick={() => {
                                      if (matchedFile) {
                                        handleFileSelect(matchedFile);
                                        setActiveTab('files');
                                      }
                                    }}
                                    className="inline-flex items-center px-2 py-1 bg-white/5 hover:bg-white/10 hover:border-accent-blue/40 border border-white/5 rounded-lg text-[9px] text-text-secondary hover:text-white transition-all cursor-pointer font-mono"
                                  >
                                    <FileCode className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'} text-accent-blue`} />
                                    {filePath.split('/').pop()}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center text-xs text-text-secondary">
                  {t('noReplayEvents')}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <CommandPalette />
    </div>
  );
}

export default function ProjectDetailsPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-primary" />}>
      <ProjectDetailsPageContent {...props} />
    </Suspense>
  );
}
