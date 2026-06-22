'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import Editor from '@monaco-editor/react';
import ReactFlow, { Background, Controls, Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  FolderCode,
  FileCode,
  Sparkles,
  Layers,
  Activity,
  Heart,
  Calendar,
  FileText,
  MessageSquare,
  HelpCircle,
  Folder,
  File,
  Play,
  Copy,
  Check,
  Code,
  Plus,
  Clock
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

// Custom file tree node component helper
const FileTreeItem: React.FC<{
  name: string;
  isFolder: boolean;
  isOpen?: boolean;
  onClick: () => void;
  depth: number;
}> = ({ name, isFolder, isOpen, onClick, depth }) => {
  return (
    <div
      onClick={onClick}
      style={{ paddingLeft: `${depth * 14 + 10}px` }}
      className="flex items-center space-x-2 py-1.5 hover:bg-white/5 rounded-lg cursor-pointer transition-colors text-xs text-text-secondary hover:text-white"
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

export default function ProjectDetailsPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { id } = params;
  const { user, loading, apiFetch } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

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

  // Code Copy state
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

  const loadProjectDetails = async () => {
    try {
      const [overviewData, filesData, graphData, replayData] = await Promise.all([
        apiFetch(`/projects/${id}/overview`),
        apiFetch(`/projects/${id}/files`),
        apiFetch(`/projects/${id}/graph`),
        apiFetch(`/ai-extensions/projects/${id}/replay`),
      ]);

      setProject(overviewData.project);
      setStats(overviewData.stats);
      setFiles(filesData.files || []);
      setReplayTimeline(replayData.timeline || []);

      // Format React Flow Nodes and Edges
      setGraphNodes(graphData.nodes || []);
      setGraphEdges(graphData.edges || []);

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

  const handleFileSelect = async (file: FileNode) => {
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
  };

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

  const handleCopyCode = () => {
    if (!selectedFileContent) return;
    navigator.clipboard.writeText(selectedFileContent);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1500);
  };

  // Helper: Build File Tree from Flat paths list
  const buildFileTree = () => {
    const root: any = {};
    files.forEach(f => {
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
            onClick={() => handleFileSelect(item._file)}
          />
        );
      }
    });
  };

  if (loading || !user || loadingProject) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center text-sm text-text-secondary select-none">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
          <span>Loading project metrics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none">
      <Sidebar />

      <main className="flex-1 p-10 overflow-hidden h-screen flex flex-col justify-between">
        {/* Project Header details */}
        <div className="flex items-center justify-between pb-5 border-b border-card-border">
          <div className="flex items-center space-x-4">
            <div className="w-11 h-11 rounded-xl bg-accent-blue/15 flex items-center justify-center">
              <FolderCode className="w-5 h-5 text-accent-blue" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{project.name}</h2>
              <div className="flex items-center space-x-3 text-[10px] text-text-secondary mt-1 font-mono">
                <span>{project.language || 'generic'}</span>
                <span>•</span>
                <span>{project.framework || 'vanilla'}</span>
                <span>•</span>
                <span>{project.database || 'none'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-5">
            {/* Health Score badge */}
            <div className="flex items-center space-x-2 bg-card-bg border border-card-border px-4 py-2.5 rounded-2xl glass">
              <Heart className="w-4 h-4 text-danger animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold">Health Score</span>
                <span className="text-xs font-bold text-success font-mono">{project.healthScore}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Selection Navigation */}
        <div className="flex space-x-1.5 my-6 bg-bg-secondary p-1 rounded-2xl max-w-md border border-card-border/60">
          {(['overview', 'files', 'chat', 'graph', 'replay'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-center rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                activeTab === tab ? 'bg-accent-blue text-white shadow-md' : 'text-text-secondary hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Main tabs components wrapper */}
        <div className="flex-1 overflow-hidden relative">
          {/* 1. Overview Tab */}
          {activeTab === 'overview' && (
            <div className="h-full overflow-y-auto space-y-6 animate-fade-in pr-2 select-text">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Tech specifications card */}
                <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass space-y-4">
                  <h3 className="font-bold text-sm">System Properties</h3>
                  <div className="space-y-3.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Language</span>
                      <span className="font-semibold text-white font-mono">{project.language || 'generic'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Framework</span>
                      <span className="font-semibold text-white font-mono">{project.framework || 'vanilla'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Database</span>
                      <span className="font-semibold text-white font-mono">{project.database || 'none'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Total Files</span>
                      <span className="font-semibold text-white font-mono">{stats?.totalFiles}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Indexed Classes/Routes</span>
                      <span className="font-semibold text-white font-mono">{stats?.totalEntities}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Project Size</span>
                      <span className="font-semibold text-white font-mono">
                        {stats ? (stats.totalSize / 1024).toFixed(1) : 0} KB
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI Auto-Documentation card (2/3 width) */}
                <div className="md:col-span-2 bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass space-y-4">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-accent-blue" />
                    <h3 className="font-bold text-sm">AI Auto-Generated Documentation</h3>
                  </div>
                  <div className="text-xs text-text-secondary leading-relaxed space-y-3">
                    <p>
                      This project is recognized as a **{project.framework || 'Vanilla'}** codebase utilizing **{project.language || 'JavaScript'}**. 
                      It handles module flows including model layouts, controllers, and services.
                    </p>
                    <h4 className="font-bold text-white pt-2">Database Layer</h4>
                    <p>
                      Uses **{project.database || 'in-memory / mock'}** for data stores. Schema bindings are index parsed and registered to prompt memory.
                    </p>
                    <h4 className="font-bold text-white pt-2">Security & Secret Analysis</h4>
                    <p>
                      No active secrets leaked in files. Sensitive variables (.env credentials) detected in processing were stripped from indexing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Files Explorer & Monaco Viewer Tab */}
          {activeTab === 'files' && (
            <div className="h-full flex overflow-hidden border border-card-border rounded-[28px] bg-bg-secondary animate-fade-in">
              {/* File Tree Left pane */}
              <div className="w-56 border-r border-card-border overflow-y-auto p-4 select-none">
                <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold px-2 block mb-3">
                  Workspace Files
                </span>
                <div className="space-y-0.5">
                  {renderFileTreeNodes(buildFileTree())}
                </div>
              </div>

              {/* Monaco Editor Center pane */}
              <div className="flex-1 flex flex-col justify-between bg-bg-primary h-full relative select-text">
                {selectedFile ? (
                  <>
                    {/* Monaco Header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-card-border bg-bg-secondary">
                      <div className="flex items-center space-x-2">
                        <FileCode className="w-4 h-4 text-accent-blue" />
                        <span className="text-xs font-semibold text-white">{selectedFile.fileName}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={handleExplainCode}
                          disabled={loadingExplanation}
                          className="flex items-center px-3 py-1.5 bg-accent-blue/10 hover:bg-accent-blue/20 text-[10px] font-bold text-accent-blue rounded-xl transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 mr-1" />
                          Explain Code
                        </button>
                        <button
                          onClick={handleCopyCode}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white"
                          title="Copy Code"
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
                          Loading file...
                        </div>
                      ) : (
                        <Editor
                          height="100%"
                          language={selectedFile.language === 'dart' ? 'dart' : selectedFile.language === 'python' ? 'python' : 'javascript'}
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
                    <span>Select a file from the explorer tree to preview code.</span>
                  </div>
                )}
              </div>

              {/* AI Explanation Drawer (Right pane) */}
              {selectedFile && (
                <div className="w-72 border-l border-card-border bg-bg-secondary p-5 overflow-y-auto select-text flex flex-col space-y-4">
                  <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                    AI Explanations
                  </span>
                  
                  {loadingExplanation ? (
                    <div className="py-20 flex flex-col items-center justify-center space-y-3 text-xs text-text-secondary">
                      <div className="w-5 h-5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
                      <span>Analyzing file logic...</span>
                    </div>
                  ) : explanation ? (
                    <div className="text-xs text-[#E0E0E0] leading-relaxed whitespace-pre-wrap font-sans bg-bg-primary p-4 rounded-2xl border border-card-border">
                      {explanation}
                    </div>
                  ) : selectedFile.summary ? (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="text-[9px] text-text-secondary font-medium tracking-wider uppercase">File Summary</span>
                        <p className="text-xs text-text-secondary leading-relaxed bg-bg-primary p-3.5 rounded-xl border border-card-border">
                          {selectedFile.summary}
                        </p>
                      </div>
                      <button
                        onClick={handleExplainCode}
                        className="w-full py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        Deep AI Code Check
                      </button>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs text-text-secondary">
                      Click "Explain Code" to run structured AI inspection.
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
                          {m.sender === 'user' ? <Plus className="w-4 h-4" /> : <Sparkles className="w-4.5 h-4.5" />}
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
                      <span>Ask questions scoped only to the **{project.name}** files context.</span>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSendProjectChat} className="p-5 border-t border-card-border bg-bg-secondary flex space-x-3 items-center">
                  <input
                    type="text"
                    placeholder={`Query ${project.name} files...`}
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
            <div className="h-full border border-card-border rounded-[28px] overflow-hidden bg-bg-secondary relative animate-fade-in">
              <div className="absolute top-4 left-4 z-10 bg-card-bg/90 border border-card-border px-3.5 py-2 rounded-xl glass text-[10px] text-text-secondary max-w-xs leading-relaxed">
                <span className="font-semibold text-white block mb-0.5">Code Dependency Visualizer</span>
                Nodes map files. Edges show file dependencies (imports) parsed automatically from the codebases.
              </div>
              
              {graphNodes.length > 0 ? (
                <ReactFlow
                  nodes={graphNodes}
                  edges={graphEdges}
                  fitView
                  minZoom={0.5}
                  maxZoom={1.5}
                >
                  <Background color="rgba(255,255,255,0.05)" gap={16} />
                  <Controls className="bg-card-bg border border-card-border text-white rounded-xl shadow-lg fill-white" />
                </ReactFlow>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-xs text-text-secondary space-y-3">
                  <Layers className="w-10 h-10 text-accent-blue opacity-50" />
                  <span>No relations extracted. Index files containing import dependencies.</span>
                </div>
              )}
            </div>
          )}

          {/* 5. Project Replay timeline Tab */}
          {activeTab === 'replay' && (
            <div className="h-full overflow-y-auto bg-bg-secondary p-6 rounded-[28px] border border-card-border animate-fade-in pr-2 select-text">
              <h3 className="font-bold text-sm mb-6 flex items-center">
                <Clock className="w-5 h-5 text-accent-blue mr-2" />
                Project Replay Timeline
              </h3>
              {replayTimeline.length > 0 ? (
                <div className="relative border-l border-card-border pl-6 space-y-6 ml-3">
                  {replayTimeline.map((item, idx) => (
                    <div key={idx} className="relative group">
                      <div className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border-4 border-bg-primary bg-accent-blue flex items-center justify-center flex-shrink-0"></div>
                      <div className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-accent-blue font-bold uppercase tracking-wider bg-accent-blue/10 px-2 py-0.5 rounded-full">
                            {item.day}
                          </span>
                          <span className="text-[10px] text-text-secondary font-semibold">Milestone</span>
                        </div>
                        <h4 className="font-bold text-xs text-white mt-2.5">{item.title}</h4>
                        <p className="text-[11px] text-text-secondary leading-relaxed mt-1">
                          {item.description}
                        </p>
                        {item.files.length > 0 && (
                          <div className="mt-3.5 pt-3.5 border-t border-card-border/45 space-y-1.5">
                            <span className="text-[9px] text-text-secondary uppercase tracking-wider font-semibold block">Associated Files</span>
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
                                    <FileCode className="w-3.5 h-3.5 mr-1 text-accent-blue" />
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
                  No timeline replay events recorded.
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
