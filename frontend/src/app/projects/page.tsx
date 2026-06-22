'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import io from 'socket.io-client';
import {
  FolderCode,
  Upload,
  Terminal,
  Activity,
  Plus,
  Trash2,
  ExternalLink,
  ChevronRight,
  Database,
  CheckCircle2,
  XCircle,
  FileArchive,
  Info
} from 'lucide-react';

interface ProjectUploadStatus {
  projectId: string;
  status: 'pending' | 'extracting' | 'parsing' | 'embedding' | 'completed' | 'failed';
  progress: number;
  message: string;
}

export default function ProjectsPage() {
  const { user, loading, apiFetch } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Upload Form State
  const [showUpload, setShowUpload] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Socket progress states
  const [activeJob, setActiveJob] = useState<ProjectUploadStatus | null>(null);

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
    if (!activeJob || activeJob.status === 'completed' || activeJob.status === 'failed') return;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5001';
    const socket = io(socketUrl);

    socket.on('connect', () => {
      console.log('[Socket]: Connected to index server, joining room project_' + activeJob.projectId);
      socket.emit('join_project', activeJob.projectId);
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
    socket.on(`${activeJob.projectId}_progress`, (data: any) => {
      setActiveJob(prev => prev ? { ...prev, ...data } : null);
      if (data.status === 'completed' || data.status === 'failed') {
        fetchProjects();
        socket.disconnect();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [activeJob]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!projectName) {
        // Auto-fill project name from ZIP name
        setProjectName(file.name.replace('.zip', ''));
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName || !selectedFile) {
      setUploadError('Please specify project name and select a ZIP file.');
      return;
    }

    setUploadError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append('name', projectName);
    formData.append('description', projectDesc);
    formData.append('project', selectedFile);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:5001/api/projects/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // Initialize local progress watcher
      setActiveJob({
        projectId: data.projectId,
        status: 'pending',
        progress: 0,
        message: 'Initializing index request...',
      });

      // Clear form
      setProjectName('');
      setProjectDesc('');
      setSelectedFile(null);
      setShowUpload(false);
    } catch (err: any) {
      setUploadError(err.message || 'File upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project? All associated file indexes, code entities and vectors will be permanently removed.')) {
      return;
    }

    try {
      await apiFetch(`/projects/${id}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(p => p._id !== id));
    } catch (err) {
      console.error('[Projects]: Delete failed:', err);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none">
      <Sidebar />

      <main className="flex-1 p-10 overflow-y-auto max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Your Repositories</h2>
            <p className="text-xs text-text-secondary mt-1">Manage and upload your code libraries for AI analysis</p>
          </div>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center px-4 py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-xs font-semibold rounded-2xl transition-all shadow-md shadow-accent-blue/10 cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Import Project
          </button>
        </div>

        {/* Live Processing progress card */}
        {activeJob && (
          <div className="mb-8 bg-card-bg/60 border border-card-border p-6 rounded-[24px] glass flex items-start space-x-5 border-l-accent-blue border-l-4">
            <div className="mt-1 w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center flex-shrink-0 animate-pulse">
              <FileArchive className="w-5 h-5 text-accent-blue" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs">Indexing Codebase...</h4>
                <span className="text-[10px] font-mono text-accent-blue font-semibold bg-accent-blue/10 px-2 py-0.5 rounded-full">
                  {activeJob.progress}%
                </span>
              </div>
              <p className="text-[11px] text-text-secondary mt-1.5">{activeJob.message}</p>
              
              {/* Progress bar */}
              <div className="w-full bg-white/5 rounded-full h-1.5 mt-3.5 overflow-hidden">
                <div
                  className="bg-accent-blue h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${activeJob.progress}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Import ZIP Form Panel */}
        {showUpload && (
          <div className="mb-8 bg-card-bg/60 border border-card-border p-6 rounded-[28px] glass hover-scale">
            <h3 className="font-bold text-sm mb-4">Import ZIP codebase</h3>
            {uploadError && (
              <div className="mb-4 p-3 bg-danger/10 border border-danger/25 text-danger rounded-xl text-xs font-medium space-y-1.5">
                <p>{uploadError}</p>
                {uploadError.toLowerCase().includes('limit') && (
                  <Link href="/billing">
                    <span className="text-accent-blue hover:underline font-bold block cursor-pointer">
                      View Plans & Upgrade ➔
                    </span>
                  </Link>
                )}
              </div>
            )}
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Project Name</label>
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
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Description</label>
                  <input
                    type="text"
                    placeholder="Optional details"
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    disabled={uploading}
                    className="w-full bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
                  />
                </div>
              </div>

              {/* File selection box */}
              <div className="border-2 border-dashed border-card-border/60 hover:border-accent-blue/40 rounded-2xl p-6 text-center transition-colors relative cursor-pointer bg-bg-primary/10">
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  required
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <Upload className="w-6 h-6 text-text-secondary opacity-70" />
                  <span className="text-xs text-white font-medium">
                    {selectedFile ? selectedFile.name : 'Click to select ZIP codebase'}
                  </span>
                  <span className="text-[10px] text-text-secondary">Supported format: ZIP Archive up to 50MB</span>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  disabled={uploading}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="px-5 py-2.5 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-accent-blue/50 text-white rounded-2xl text-xs font-semibold cursor-pointer"
                >
                  {uploading ? 'Uploading ZIP...' : 'Start Indexing'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Projects Listing */}
        <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass">
          {loadingProjects ? (
            <div className="py-20 flex justify-center">
              <div className="w-6 h-6 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
            </div>
          ) : projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {projects.map((p) => (
                <div
                  key={p._id}
                  onClick={() => router.push(`/projects/${p._id}`)}
                  className="p-5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all duration-150 cursor-pointer flex flex-col justify-between h-[150px] relative group"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8.5 h-8.5 rounded-lg bg-accent-blue/15 flex items-center justify-center">
                          <FolderCode className="w-4 h-4 text-accent-blue" />
                        </div>
                        <h3 className="font-bold text-xs text-white max-w-[150px] truncate">{p.name}</h3>
                      </div>
                      
                      <button
                        onClick={(e) => handleDeleteProject(e, p._id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 bg-danger/10 hover:bg-danger/25 text-danger rounded-lg transition-all"
                        title="Delete codebase"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[10px] text-text-secondary mt-2.5 line-clamp-2 leading-relaxed">
                      {p.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-card-border/40 pt-3 mt-3">
                    <span className="text-[9px] text-text-secondary font-mono">
                      {p.language || 'Generic'} • {p.framework || 'Vanilla'}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      p.healthScore >= 90 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                    }`}>
                      {p.healthScore}% health
                    </span>
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
                <span className="text-white font-medium">No projects imported yet</span>
                <span>Click "Import Project" above and upload a ZIP file of your codebase.</span>
              </div>
            </div>
          )}
        </div>
      </main>

      <CommandPalette />
    </div>
  );
}
