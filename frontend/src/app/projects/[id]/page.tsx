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
  Download,
  AlertTriangle
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

interface KnowledgeRelationship {
  id?: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relationshipType?: string;
  displayName?: string;
  displayType?: string;
  displaySubtitle?: string;
  sourceDisplayName?: string;
  targetDisplayName?: string;
  sourceDisplayType?: string;
  targetDisplayType?: string;
  sourceDisplaySubtitle?: string;
  targetDisplaySubtitle?: string;
  sourcePath?: string;
  targetPath?: string;
  confidence?: number;
  evidence?: {
    filePath?: string;
    sourceLine?: number;
    targetLine?: number;
    snippet?: string;
    reason?: string;
  };
  metadata?: Record<string, unknown>;
}

interface Citation {
  id?: string;
  type?: string;
  domainType?: string;
  title?: string;
  subtitle?: string;
  path?: string;
  relationshipType?: string;
  confidence?: number;
  source?: 'code' | 'search' | 'memory' | 'debugging_lesson' | 'architecture_blueprint' | 'knowledge_relationship';
  navigation?: {
    route?: string;
    projectId?: string;
    fileId?: string;
    entityId?: string;
  };
  fileName?: string;
  score?: number;
}

interface EntityRelationships {
  incoming: KnowledgeRelationship[];
  outgoing: KnowledgeRelationship[];
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

const formatConfidence = (confidence?: number) => {
  if (typeof confidence !== 'number') return '70%';
  return `${Math.round(confidence * 100)}%`;
};

const humanizeRelationshipType = (relationshipType?: string) => {
  const labels: Record<string, string> = {
    contains: 'Contains',
    defines: 'Defines',
    imports: 'Imports',
    exports: 'Exports',
    calls: 'Calls',
    uses: 'Uses',
    depends_on: 'Depends on',
    extends: 'Extends',
    implements: 'Implements',
    similar_to: 'Similar to',
    solves: 'Solves',
    documents: 'Documents',
    mentioned_in: 'Mentioned in',
    generated_from: 'Generated from',
    related_to: 'Related to',
  };
  if (!relationshipType) return 'Related to';
  return labels[relationshipType] || relationshipType.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const humanizeCitationLabel = (value?: string) => {
  if (!value) return 'Source';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const citationTitle = (citation: Citation) => (
  citation.title || citation.fileName || citation.path || 'Source'
);

const citationConfidence = (citation: Citation) => {
  const value = typeof citation.confidence === 'number' ? citation.confidence : citation.score;
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : undefined;
};

const isSourceAssetCitation = (citation: Citation) => (
  citation.domainType === 'source_asset' ||
  citation.type === 'file' ||
  citation.source === 'code'
);

const RELATIONSHIP_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'contains', label: 'Contains' },
  { value: 'defines', label: 'Defines' },
  { value: 'imports', label: 'Imports' },
  { value: 'exports', label: 'Exports' },
  { value: 'calls', label: 'Calls' },
  { value: 'uses', label: 'Uses' },
  { value: 'depends_on', label: 'Depends on' },
  { value: 'extends', label: 'Extends' },
  { value: 'implements', label: 'Implements' },
  { value: 'similar_to', label: 'Similar to' },
  { value: 'solves', label: 'Solves' },
  { value: 'documents', label: 'Documents' },
  { value: 'related_to', label: 'Related to' },
] as const;

const isValidObjectIdString = (value?: string) => (
  typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)
);

const isSafeCitationRoute = (route?: string): route is string => (
  typeof route === 'string' &&
  (
    /^\/projects\/[a-f\d]{24}(\?fileId=[a-f\d]{24})?$/i.test(route) ||
    /^\/(snippets|errors|systems)(\?id=[a-f\d]{24})?$/i.test(route)
  )
);

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
  const [projectError, setProjectError] = useState<string | null>(null);

  // File tree states
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [selectedFileContent, setSelectedFileContent] = useState('');
  const [loadingFileContent, setLoadingFileContent] = useState(false);
  const [fileContentError, setFileContentError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [fileQuery, setFileQuery] = useState('');

  // AI explanation state
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [explanationRelationships, setExplanationRelationships] = useState<KnowledgeRelationship[]>([]);
  const [explanationCitations, setExplanationCitations] = useState<Citation[]>([]);

  // Scoped chat states
  const [projectMessages, setProjectMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [projectChatError, setProjectChatError] = useState<string | null>(null);

  // React Flow graph states
  const [graphNodes, setGraphNodes] = useState<Node[]>([]);
  const [graphEdges, setGraphEdges] = useState<Edge[]>([]);
  const [selectedGraphNode, setSelectedGraphNode] = useState<Node | null>(null);
  const [graphView, setGraphView] = useState<'dependency' | 'knowledge'>('dependency');
  const [activeRelationshipFilter, setActiveRelationshipFilter] = useState<string>('all');
  const [relationshipSearchQuery, setRelationshipSearchQuery] = useState('');
  const [showKnowledgeLegend, setShowKnowledgeLegend] = useState(false);
  const [knowledgeRelationships, setKnowledgeRelationships] = useState<KnowledgeRelationship[]>([]);
  const [loadingKnowledgeGraph, setLoadingKnowledgeGraph] = useState(false);
  const [knowledgeGraphError, setKnowledgeGraphError] = useState<string | null>(null);
  const [selectedKnowledgeNode, setSelectedKnowledgeNode] = useState<Node | null>(null);
  const [selectedEntityRelationships, setSelectedEntityRelationships] = useState<EntityRelationships | null>(null);
  const [loadingEntityRelationships, setLoadingEntityRelationships] = useState(false);
  const [entityRelationshipsError, setEntityRelationshipsError] = useState<string | null>(null);

  // Code Copy state
  const [codeCopied, setCodeCopied] = useState(false);
  const isRtl = dir === 'rtl';

  const getKnowledgeNodeLabel = (entityType: string, entityId: string, displayName?: string) => {
    if (displayName) return displayName;
    if (entityType === 'codebase') return project?.name || 'Codebase';
    if (entityType === 'source_asset') {
      const file = files.find((item) => item._id === entityId);
      return file?.fileName || `File ${entityId.slice(-6)}`;
    }
    if (entityType === 'logical_entity') return `Entity ${entityId.slice(-6)}`;
    return `${entityType.replace(/_/g, ' ')} ${entityId.slice(-6)}`;
  };

  const getKnowledgeNodePath = (entityType: string, entityId: string, displaySubtitle?: string, displayPath?: string) => {
    if (displayPath) return displayPath;
    if (displaySubtitle) return displaySubtitle;
    if (entityType !== 'source_asset') return entityType;
    const file = files.find((item) => item._id === entityId);
    return file?.path || entityType;
  };

  const filterRelationshipsByType = (relationships: KnowledgeRelationship[]) => {
    if (activeRelationshipFilter === 'all') return relationships;
    return relationships.filter((relationship) => relationship.relationshipType === activeRelationshipFilter);
  };

  const filteredKnowledgeRelationships = useMemo(
    () => filterRelationshipsByType(knowledgeRelationships),
    [knowledgeRelationships, activeRelationshipFilter]
  );

  const relationshipSearchTerm = relationshipSearchQuery.trim().toLowerCase();

  const searchedKnowledgeRelationships = useMemo(() => {
    if (!relationshipSearchTerm) return filteredKnowledgeRelationships;
    return filteredKnowledgeRelationships.filter((relationship) => {
      const searchableText = [
        relationship.sourceDisplayName,
        relationship.targetDisplayName,
        relationship.displayName,
        relationship.sourcePath,
        relationship.targetPath,
        relationship.relationshipType,
        relationship.evidence?.reason,
        relationship.evidence?.snippet,
        relationship.displaySubtitle,
        relationship.sourceDisplaySubtitle,
        relationship.targetDisplaySubtitle,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(relationshipSearchTerm);
    });
  }, [filteredKnowledgeRelationships, relationshipSearchTerm]);

  const relationshipFilterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: knowledgeRelationships.length };
    knowledgeRelationships.forEach((relationship) => {
      if (!relationship.relationshipType) return;
      counts[relationship.relationshipType] = (counts[relationship.relationshipType] || 0) + 1;
    });
    return counts;
  }, [knowledgeRelationships]);

  const hasActiveRelationshipFilters = activeRelationshipFilter !== 'all' || relationshipSearchQuery.trim().length > 0;

  const resetRelationshipFilters = () => {
    setActiveRelationshipFilter('all');
    setRelationshipSearchQuery('');
  };

  const knowledgeGraphElements = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    const relationshipEdges: Edge[] = [];
    const addNode = (entityType: string, entityId: string, displayName?: string, displaySubtitle?: string, displayPath?: string) => {
      const key = `${entityType}:${entityId}`;
      if (nodeMap.has(key)) return;

      const file = entityType === 'source_asset' ? files.find((item) => item._id === entityId) : undefined;
      const index = nodeMap.size;
      const angle = index === 0 ? 0 : (index / Math.max(knowledgeRelationships.length, 1)) * Math.PI * 2;
      const radius = entityType === 'codebase' ? 0 : 260;

      nodeMap.set(key, {
        id: key,
        type: entityType === 'source_asset' ? 'fileNode' : 'default',
        position: {
          x: entityType === 'codebase' ? 0 : Math.round(Math.cos(angle) * radius),
          y: entityType === 'codebase' ? 0 : Math.round(Math.sin(angle) * radius),
        },
        data: {
          label: getKnowledgeNodeLabel(entityType, entityId, displayName),
          path: getKnowledgeNodePath(entityType, entityId, displaySubtitle, displayPath),
          entityType,
          entityId,
          language: file?.language,
          extension: file?.extension,
          size: file?.size,
          summary: file?.summary,
        },
        style: entityType === 'source_asset' ? undefined : {
          border: '1px solid rgba(157,189,255,0.35)',
          borderRadius: 14,
          background: entityType === 'codebase' ? 'rgba(10,132,255,0.16)' : 'rgba(28,28,30,0.95)',
          color: '#fff',
          fontSize: 11,
          padding: 12,
          minWidth: 150,
        },
      });
    };

    searchedKnowledgeRelationships.forEach((relationship, index) => {
      addNode(
        relationship.sourceType,
        relationship.sourceId,
        relationship.sourceDisplayName,
        relationship.sourceDisplaySubtitle,
        relationship.sourcePath
      );
      addNode(
        relationship.targetType,
        relationship.targetId,
        relationship.targetDisplayName,
        relationship.targetDisplaySubtitle,
        relationship.targetPath
      );
      relationshipEdges.push({
        id: relationship.id || `knowledge-${index}`,
        source: `${relationship.sourceType}:${relationship.sourceId}`,
        target: `${relationship.targetType}:${relationship.targetId}`,
        label: relationship.displayType || humanizeRelationshipType(relationship.relationshipType),
        animated: false,
        data: relationship,
        style: { stroke: '#30D158', strokeWidth: 1.6, opacity: 0.8 },
        labelStyle: { fill: '#D1D5DB', fontSize: 10, fontWeight: 700 },
        labelBgStyle: { fill: 'rgba(8,11,18,0.88)' },
      });
    });

    return { nodes: Array.from(nodeMap.values()), edges: relationshipEdges };
  }, [searchedKnowledgeRelationships, files, project?.name]);

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
    if (!isValidObjectIdString(id)) {
      setProject(null);
      setStats(null);
      setFiles([]);
      setGraphNodes([]);
      setGraphEdges([]);
      setProjectError(isRtl ? 'معرّف المشروع غير صالح.' : 'Invalid project id.');
      setLoadingProject(false);
      return;
    }

    setLoadingProject(true);
    setProjectError(null);
    try {
      const [overviewData, filesData] = await Promise.all([
        apiFetch(`/projects/${id}/overview`),
        apiFetch(`/projects/${id}/files`),
      ]);

      setProject(overviewData.project);
      setStats(overviewData.stats);
      setFiles(filesData.files || []);

      const [graphResult, replayResult, healthResult] = await Promise.allSettled([
        apiFetch(`/projects/${id}/graph`),
        apiFetch(`/ai-extensions/projects/${id}/replay`),
        apiFetch(`/projects/${id}/health`),
      ]);

      if (healthResult.status === 'fulfilled') {
        setProject((current: any) => current ? { ...current, healthScore: healthResult.value.healthScore } : current);
      } else {
        console.warn('[ProjectDetail]: Optional health load failed:', healthResult.reason);
      }

      if (replayResult.status === 'fulfilled') {
        setReplayTimeline(replayResult.value.timeline || []);
      } else {
        console.warn('[ProjectDetail]: Optional replay load failed:', replayResult.reason);
        setReplayTimeline([]);
      }

      const graphData = graphResult.status === 'fulfilled' ? graphResult.value : { nodes: [], edges: [] };
      if (graphResult.status === 'rejected') {
        console.warn('[ProjectDetail]: Optional dependency graph load failed:', graphResult.reason);
      }

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
      setProject(null);
      setStats(null);
      setFiles([]);
      setGraphNodes([]);
      setGraphEdges([]);
      setProjectError(isRtl ? 'تعذر تحميل المشروع أو ربما تم حذفه.' : 'Unable to load this project. It may have been deleted or you may not have access.');
    } finally {
      setLoadingProject(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadProjectDetails();
  }, [user, id]);

  const loadKnowledgeGraph = async () => {
    setLoadingKnowledgeGraph(true);
    setKnowledgeGraphError(null);
    try {
      const data = await apiFetch(`/knowledge-graph/neighborhood?entityType=codebase&entityId=${id}&depth=1`);
      setKnowledgeRelationships(Array.isArray(data.relationships)
        ? data.relationships
        : [...(data.outgoing || []), ...(data.incoming || [])]
      );
    } catch (err) {
      console.error('[ProjectDetail]: Knowledge graph load failed:', err);
      setKnowledgeGraphError(isRtl ? 'تعذر تحميل علاقات المعرفة' : 'Unable to load knowledge relationships.');
      setKnowledgeRelationships([]);
    } finally {
      setLoadingKnowledgeGraph(false);
    }
  };

  const loadEntityRelationships = async (node: Node) => {
    const entityType = node.data?.entityType;
    const entityId = node.data?.entityId;
    setSelectedKnowledgeNode(node);
    setSelectedEntityRelationships(null);
    setEntityRelationshipsError(null);

    if (!entityType || !entityId) {
      setEntityRelationshipsError(isRtl ? 'لا توجد بيانات كافية لهذه العقدة' : 'No relationship lookup available for this node.');
      return;
    }

    setLoadingEntityRelationships(true);
    try {
      const data = await apiFetch(`/knowledge-graph/entity/${entityType}/${entityId}/relationships`);
      setSelectedEntityRelationships({
        incoming: Array.isArray(data.incoming) ? data.incoming : [],
        outgoing: Array.isArray(data.outgoing) ? data.outgoing : [],
      });
    } catch (err) {
      console.error('[ProjectDetail]: Entity relationships load failed:', err);
      setEntityRelationshipsError(isRtl ? 'تعذر تحميل علاقات هذه العقدة' : 'Unable to load relationships for this node.');
    } finally {
      setLoadingEntityRelationships(false);
    }
  };

  useEffect(() => {
    if (!user || activeTab !== 'graph' || graphView !== 'knowledge') return;
    if (knowledgeRelationships.length > 0 || loadingKnowledgeGraph) return;
    loadKnowledgeGraph();
  }, [user, activeTab, graphView, id]);

  useEffect(() => {
    if (fileQuery.trim()) {
      expandAllFolders();
    }
  }, [fileQuery]);

  async function handleFileSelect(file: FileNode) {
    setSelectedFile(file);
    setLoadingFileContent(true);
    setFileContentError(null);
    setExplanation(null);
    setExplanationError(null);
    setExplanationRelationships([]);
    setExplanationCitations([]);
    if (!isValidObjectIdString(id) || !isValidObjectIdString(file?._id)) {
      setSelectedFileContent('');
      setFileContentError(isRtl ? 'لا يمكن تحميل هذا الملف.' : 'Unable to load this file.');
      setLoadingFileContent(false);
      return;
    }

    try {
      const data = await apiFetch(`/projects/${id}/files/${file._id}`);
      setSelectedFileContent(data.content || '');
    } catch (err) {
      console.error('[ProjectDetail]: File load failed:', err);
      setSelectedFileContent('');
      setFileContentError(isRtl ? 'تعذر تحميل محتوى الملف.' : 'Unable to load file content.');
    } finally {
      setLoadingFileContent(false);
    }
  }

  const handleExplainCode = async () => {
    if (!selectedFile || !selectedFileContent || loadingExplanation) return;
    setLoadingExplanation(true);
    setExplanationError(null);
    setExplanationCitations([]);
    try {
      const data = await apiFetch('/ai/explain-code', {
        method: 'POST',
        body: JSON.stringify({
          code: selectedFileContent,
          fileName: selectedFile.fileName,
          language: selectedFile.language,
          projectId: id,
          fileId: selectedFile._id,
        }),
      });
      setExplanation(data.explanation || (isRtl ? 'لم يتم إرجاع شرح من خدمة الذكاء الاصطناعي.' : 'The AI service did not return an explanation.'));
      setExplanationRelationships(Array.isArray(data.relatedRelationships) ? data.relatedRelationships : []);
      setExplanationCitations(Array.isArray(data.citations) ? data.citations : []);
    } catch (err) {
      console.error('[ProjectDetail]: Explain failed:', err);
      setExplanationError(isRtl ? 'تعذر شرح هذا الملف حالياً.' : 'Unable to explain this file right now.');
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
    setProjectChatError(null);

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
        {
          sender: 'assistant',
          text: data.answer || (isRtl ? 'لم يتم إرجاع إجابة من خدمة الذكاء الاصطناعي.' : 'The AI service did not return an answer.'),
          citations: data.citations || [],
          relatedRelationships: Array.isArray(data.relatedRelationships) ? data.relatedRelationships : [],
        },
      ]);
    } catch (err) {
      console.error('[ProjectDetail/Chat]: Message failed:', err);
      const message = isRtl ? 'تعذر إرسال الرسالة حالياً.' : 'Unable to send this message right now.';
      setProjectChatError(message);
      setProjectMessages(prev => [...prev, { sender: 'assistant', text: message }]);
    } finally {
      setSendingChat(false);
    }
  };

  const handleDeleteProject = async () => {
    // Only the project owner can delete. Guard before the API call to avoid
    // confusing error messages for workspace members who can view but not destroy.
    if (project?.userId && user?.id && project.userId.toString() !== user.id) {
      setProjectError(isRtl ? 'فقط مالك المشروع يمكنه حذفه.' : 'Only the project owner can delete this project.');
      return;
    }
    if (!confirm(t('confirmDeleteProject'))) {
      return;
    }
    try {
      await apiFetch(`/projects/${id}`, { method: 'DELETE' });
      router.push('/projects');
    } catch (err) {
      console.error('[ProjectDetail]: Delete failed:', err);
      setProjectError(isRtl ? 'تعذر حذف المشروع.' : 'Unable to delete project.');
    }
  };

  const handleDownloadZip = async () => {
    if (!isValidObjectIdString(id)) {
      setProjectError(isRtl ? 'معرّف المشروع غير صالح.' : 'Invalid project id.');
      return;
    }

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
      a.download = `${project?.name || 'project'}.zip`;
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

  const renderRelationshipRow = (relationship: KnowledgeRelationship, mode: 'incoming' | 'outgoing') => {
    const counterpartType = mode === 'incoming' ? relationship.sourceType : relationship.targetType;
    const counterpartId = mode === 'incoming' ? relationship.sourceId : relationship.targetId;
    const counterpartName = mode === 'incoming'
      ? relationship.sourceDisplayName
      : relationship.targetDisplayName;
    const counterpartPath = mode === 'incoming'
      ? relationship.sourcePath || relationship.sourceDisplaySubtitle
      : relationship.targetPath || relationship.targetDisplaySubtitle;
    const evidence = relationship.evidence || {};

    return (
      <div
        key={relationship.id || `${mode}-${relationship.sourceType}-${relationship.sourceId}-${relationship.targetType}-${relationship.targetId}-${relationship.relationshipType}`}
        className="rounded-xl border border-card-border bg-bg-primary/45 p-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-white">
              {relationship.displayType || humanizeRelationshipType(relationship.relationshipType)}
            </div>
            <div className="mt-1 truncate text-[9px] font-mono text-text-secondary">
              {counterpartName || `${counterpartType} ${counterpartId.slice(-8)}`}
            </div>
            {counterpartPath && (
              <div className="mt-1 truncate text-[9px] font-mono text-text-muted">
                {counterpartPath}
              </div>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-success/10 px-2 py-1 text-[9px] font-bold text-success">
            {formatConfidence(relationship.confidence)}
          </span>
        </div>
        {(evidence.reason || evidence.filePath || evidence.sourceLine || evidence.snippet) && (
          <div className="mt-2 space-y-1 text-[10px] leading-relaxed text-text-secondary">
            {evidence.reason && <p>{evidence.reason}</p>}
            {evidence.filePath && (
              <p className="font-mono text-[9px] text-text-muted">
                {evidence.filePath}{evidence.sourceLine ? `:${evidence.sourceLine}` : ''}
              </p>
            )}
            {evidence.snippet && (
              <p className="line-clamp-2 rounded-lg bg-white/5 p-2 font-mono text-[9px] text-text-secondary">
                {evidence.snippet}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderRelatedKnowledge = (relationships?: KnowledgeRelationship[]) => {
    if (!relationships || relationships.length === 0) return null;
    return (
      <div className="mt-3 rounded-2xl border border-card-border bg-bg-primary/45 p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
          <GitBranch className="h-3.5 w-3.5 text-success" />
          Related Knowledge
        </div>
        <div className="space-y-2">
          {relationships.slice(0, 6).map((relationship) => renderRelationshipRow(relationship, 'outgoing'))}
        </div>
      </div>
    );
  };

  const isCitationClickable = (citation: Citation) => {
    if (isSourceAssetCitation(citation)) {
      return Boolean(
        files.some((file) =>
          file._id === citation.navigation?.fileId ||
          file.path === citation.path ||
          file.fileName === citation.fileName ||
          file.fileName === citation.title
        )
      );
    }
    return isSafeCitationRoute(citation.navigation?.route);
  };

  const handleCitationClick = (citation: Citation) => {
    if (isSourceAssetCitation(citation)) {
      const matchedFile = files.find((file) =>
        file._id === citation.navigation?.fileId ||
        file.path === citation.path ||
        file.fileName === citation.fileName ||
        file.fileName === citation.title
      );
      if (matchedFile) {
        handleFileSelect(matchedFile);
        setActiveTab('files');
      }
      return;
    }

    if (citation.navigation?.route) {
      const route = citation.navigation.route;
      if (isSafeCitationRoute(route)) {
        router.push(route);
      }
    }
  };

  const renderCitations = (citations?: Citation[]) => {
    if (!citations || citations.length === 0) return null;
    return (
      <div className="mt-3 rounded-2xl border border-card-border bg-bg-primary/45 p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
          <FileCode className="h-3.5 w-3.5 text-accent-blue" />
          Sources
        </div>
        <div className="space-y-2">
          {citations.slice(0, 8).map((citation, index) => (
            <div
              key={citation.id || `${citation.source || 'source'}-${index}`}
              onClick={() => handleCitationClick(citation)}
              onKeyDown={(event) => {
                if (isCitationClickable(citation) && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  handleCitationClick(citation);
                }
              }}
              role={isCitationClickable(citation) ? 'button' : undefined}
              tabIndex={isCitationClickable(citation) ? 0 : undefined}
              title={isCitationClickable(citation) ? `Open source: ${citationTitle(citation)}` : citationTitle(citation)}
              aria-label={isCitationClickable(citation) ? `Open source ${citationTitle(citation)}` : undefined}
              className={`rounded-xl border border-card-border bg-bg-primary/45 p-3 transition ${
                isCitationClickable(citation) ? 'cursor-pointer hover:border-accent-blue/40 hover:bg-white/5' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-bold text-white">{citationTitle(citation)}</div>
                  {citation.path && (
                    <div className="mt-1 truncate font-mono text-[9px] text-text-muted">{citation.path}</div>
                  )}
                </div>
                {citationConfidence(citation) && (
                  <span className="shrink-0 rounded-full bg-success/10 px-2 py-1 text-[9px] font-bold text-success">
                    {citationConfidence(citation)}
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-accent-blue/10 px-2 py-1 text-[9px] font-bold text-accent-blue">
                  {humanizeCitationLabel(citation.domainType || citation.type || citation.source)}
                </span>
                {citation.relationshipType && (
                  <span className="rounded-full bg-success/10 px-2 py-1 text-[9px] font-bold text-success">
                    {humanizeRelationshipType(citation.relationshipType)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading || !user || loadingProject) {
    return <AppPageSkeleton label={t('loadingProjectMetrics')} />;
  }

  if (projectError || !project) {
    return (
      <div className="flex min-h-screen bg-bg-primary text-white" dir={dir}>
        <Sidebar />
        <main className="flex-1 px-5 py-10 lg:px-10">
          <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
            <div className="w-full rounded-[28px] border border-danger/25 bg-danger/10 p-6 text-center glass">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-danger/20 bg-danger/10">
                <AlertTriangle className="h-6 w-6 text-danger" />
              </div>
              <h2 className="text-lg font-bold text-white">
                {isRtl ? 'تعذر فتح المشروع' : 'Unable to open project'}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                {projectError || (isRtl ? 'المشروع غير متاح.' : 'This project is unavailable.')}
              </p>
              <button
                type="button"
                onClick={() => router.push('/projects')}
                className="mt-5 rounded-2xl bg-accent-blue px-5 py-3 text-xs font-semibold text-white transition hover:bg-accent-blue/90"
              >
                {isRtl ? 'العودة إلى المشاريع' : 'Back to projects'}
              </button>
            </div>
          </div>
        </main>
        <CommandPalette />
      </div>
    );
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
            {/* Only the project owner sees the delete button */}
            {(!project?.userId || !user?.id || project.userId.toString() === user.id) && (
              <button
                onClick={handleDeleteProject}
                className="inline-flex items-center gap-2 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-xs font-semibold text-danger transition hover:bg-danger/25 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                {t('deleteProjectBtn')}
              </button>
            )}
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
                          disabled={loadingExplanation || loadingFileContent || Boolean(fileContentError)}
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
                      ) : fileContentError ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-xs text-text-secondary">
                          <AlertTriangle className="h-8 w-8 text-danger" />
                          <span>{fileContentError}</span>
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
                  ) : explanationError ? (
                    <div className="rounded-2xl border border-danger/25 bg-danger/10 p-4 text-xs leading-relaxed text-danger">
                      {explanationError}
                    </div>
                  ) : explanation ? (
                    <div>
                      <div className="text-xs text-[#E0E0E0] leading-relaxed whitespace-pre-wrap font-sans bg-bg-primary p-4 rounded-2xl border border-card-border">
                        {explanation}
                      </div>
                      {renderCitations(explanationCitations)}
                      {renderRelatedKnowledge(explanationRelationships)}
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
                  {projectChatError && (
                    <div className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-xs font-semibold text-danger">
                      {projectChatError}
                    </div>
                  )}
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
                          {m.sender === 'assistant' && renderCitations(m.citations)}
                          {m.sender === 'assistant' && renderRelatedKnowledge(m.relatedRelationships)}
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
              <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 gap-1 rounded-2xl border border-card-border bg-card-bg/90 p-1 text-[10px] font-bold glass">
                {(['dependency', 'knowledge'] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => {
                      setGraphView(view);
                      setSelectedGraphNode(null);
                      setSelectedKnowledgeNode(null);
                    }}
                    className={`rounded-xl px-3 py-2 transition ${
                      graphView === view ? 'bg-accent-blue text-white' : 'text-text-secondary hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {view === 'dependency' ? 'Dependency Graph' : 'Knowledge Relationships'}
                  </button>
                ))}
              </div>
              {graphView === 'knowledge' && (
                <div className="absolute left-1/2 top-16 z-20 w-[min(860px,78%)] -translate-x-1/2 rounded-2xl border border-card-border bg-card-bg/90 p-2 text-[10px] font-bold glass">
                  <div className="relative mb-2">
                    <Search className={`absolute top-2.5 h-3.5 w-3.5 text-text-secondary ${isRtl ? 'right-3' : 'left-3'}`} />
                    <input
                      value={relationshipSearchQuery}
                      onChange={(event) => setRelationshipSearchQuery(event.target.value)}
                      placeholder="Search relationships..."
                      className={`w-full rounded-xl border border-card-border bg-bg-primary/60 py-2 text-[11px] text-white outline-none transition focus:border-success/40 ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                    />
                    {hasActiveRelationshipFilters && (
                      <button
                        type="button"
                        onClick={resetRelationshipFilters}
                        className={`absolute top-1.5 rounded-lg border border-card-border bg-white/5 px-2 py-1 text-[9px] font-bold text-text-secondary transition hover:bg-white/10 hover:text-white ${isRtl ? 'left-2' : 'right-2'}`}
                      >
                        Reset filters
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {RELATIONSHIP_FILTERS.map((filter) => (
                      <button
                        key={filter.value}
                        type="button"
                        onClick={() => setActiveRelationshipFilter(filter.value)}
                        className={`rounded-xl px-2.5 py-1.5 transition ${
                          activeRelationshipFilter === filter.value
                            ? 'bg-success/20 text-success ring-1 ring-success/30'
                            : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span>{filter.label}</span>
                        {relationshipFilterCounts[filter.value] > 0 && (
                          <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] ${
                            activeRelationshipFilter === filter.value
                              ? 'bg-success/20 text-success'
                              : 'bg-white/10 text-text-muted'
                          }`}>
                            {relationshipFilterCounts[filter.value]}
                          </span>
                        )}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowKnowledgeLegend((value) => !value)}
                      className={`rounded-xl px-2.5 py-1.5 transition ${
                        showKnowledgeLegend
                          ? 'bg-accent-blue/20 text-accent-blue ring-1 ring-accent-blue/30'
                          : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      Legend
                    </button>
                  </div>
                  {showKnowledgeLegend && (
                    <div className="mt-2 grid gap-2 rounded-xl border border-card-border bg-bg-primary/70 p-3 text-[10px] leading-relaxed text-text-secondary md:grid-cols-2">
                      <div>
                        <div className="mb-1 font-bold text-white">Node types</div>
                        <div className="flex flex-wrap gap-1.5">
                          {['Codebase', 'Source Asset', 'Logical Entity', 'Code Asset', 'Debugging Lesson', 'Architecture Blueprint', 'Memory'].map((label) => (
                            <span key={label} className="rounded-full bg-accent-blue/10 px-2 py-1 text-accent-blue">
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 font-bold text-white">Relationship labels</div>
                        <div className="flex flex-wrap gap-1.5">
                          {['Contains', 'Defines', 'Imports', 'Exports', 'Calls', 'Uses', 'Depends on', 'Similar to', 'Solves', 'Documents', 'Related to'].map((label) => (
                            <span key={label} className="rounded-full bg-success/10 px-2 py-1 text-success">
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white/5 p-2">
                        <span className="font-bold text-white">Confidence badge</span>
                        <span className="block">Shows how strongly DevVault inferred the relationship.</span>
                      </div>
                      <div className="rounded-lg bg-white/5 p-2">
                        <span className="font-bold text-white">Evidence text/path</span>
                        <span className="block">Shows the reason, snippet, file path, or source line used for the relationship.</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className={`absolute top-4 ${isRtl ? 'right-4' : 'left-4'} z-10 max-w-sm rounded-2xl border border-card-border bg-card-bg/90 px-4 py-3 text-[10px] leading-relaxed text-text-secondary shadow-2xl shadow-black/30 glass`}>
                <div className="mb-1 flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-accent-blue" />
                  <span className="font-semibold text-white">
                    {graphView === 'dependency' ? t('graphExplorer') : 'Knowledge Relationships'}
                  </span>
                </div>
                <span>
                  {graphView === 'dependency'
                    ? t('graphNodesDesc')
                    : (isRtl ? 'علاقات MongoDB المباشرة لهذا المشروع.' : 'Direct MongoDB knowledge relationships for this project.')}
                </span>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-accent-blue/10 px-2 py-1 text-accent-blue">
                    {t('nodesCount', { count: 'COUNT' }).split('COUNT').map((part, idx) => (
                      idx === 0 ? <React.Fragment key={idx}>{part}<AnimatedCounter value={graphView === 'dependency' ? graphNodes.length : knowledgeGraphElements.nodes.length} /></React.Fragment> : part
                    ))}
                  </span>
                  <span className="rounded-full bg-success/10 px-2 py-1 text-success">
                    {t('edgesCount', { count: 'COUNT' }).split('COUNT').map((part, idx) => (
                      idx === 0 ? <React.Fragment key={idx}>{part}<AnimatedCounter value={graphView === 'dependency' ? graphEdges.length : knowledgeGraphElements.edges.length} /></React.Fragment> : part
                    ))}
                  </span>
                  <span className="rounded-full bg-white/5 px-2 py-1 text-text-secondary">{isRtl ? 'اضغط على ملف لعرض التفاصيل' : 'Click a file for details'}</span>
                </div>
              </div>
              <div className={`absolute ${isRtl ? 'left-4' : 'right-4'} top-4 z-10 rounded-2xl border border-card-border bg-card-bg/90 px-3 py-2 text-[10px] text-text-secondary glass flex items-center gap-2`}>
                <Maximize2 className="h-3.5 w-3.5 text-accent-blue" />
                {t('graphInteractInstruction')}
              </div>

              {graphView === 'dependency' && selectedGraphNode && (
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

              {graphView === 'knowledge' && selectedKnowledgeNode && (
                <div className={`absolute bottom-4 ${isRtl ? 'right-4' : 'left-4'} z-10 max-h-[70%] w-[360px] overflow-y-auto rounded-2xl border border-card-border bg-card-bg/95 p-4 shadow-2xl shadow-black/40 glass`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-bold text-white">{selectedKnowledgeNode.data?.label}</h4>
                      <p className="mt-1 truncate text-[10px] font-mono text-text-secondary">
                        {selectedKnowledgeNode.data?.entityType} · {selectedKnowledgeNode.data?.entityId?.slice(-8)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedKnowledgeNode(null);
                        setSelectedEntityRelationships(null);
                      }}
                      className="rounded-lg px-2 py-1 text-[10px] text-text-secondary hover:bg-white/10 hover:text-white"
                    >
                      {isRtl ? 'إغلاق' : 'Close'}
                    </button>
                  </div>

                  {loadingEntityRelationships ? (
                    <div className="py-8 text-center text-[11px] text-text-secondary">
                      {isRtl ? 'جار تحميل العلاقات...' : 'Loading relationships...'}
                    </div>
                  ) : entityRelationshipsError ? (
                    <div className="rounded-xl border border-danger/20 bg-danger/10 p-3 text-[11px] text-danger">
                      {entityRelationshipsError}
                    </div>
                  ) : selectedEntityRelationships ? (
                    <div className="space-y-4">
                      <div>
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                          {isRtl ? 'العلاقات الواردة' : 'Incoming relationships'}
                        </div>
                        <div className="space-y-2">
                          {filterRelationshipsByType(selectedEntityRelationships.incoming).length > 0
                            ? filterRelationshipsByType(selectedEntityRelationships.incoming).map((relationship) => renderRelationshipRow(relationship, 'incoming'))
                            : <div className="rounded-xl bg-white/5 p-3 text-[10px] text-text-secondary">
                                {activeRelationshipFilter === 'all'
                                  ? (isRtl ? 'لا توجد علاقات واردة' : 'No incoming relationships')
                                  : (isRtl ? 'لا توجد علاقات واردة لهذا الفلتر' : 'No incoming relationships for this filter.')}
                              </div>}
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                          {isRtl ? 'العلاقات الصادرة' : 'Outgoing relationships'}
                        </div>
                        <div className="space-y-2">
                          {filterRelationshipsByType(selectedEntityRelationships.outgoing).length > 0
                            ? filterRelationshipsByType(selectedEntityRelationships.outgoing).map((relationship) => renderRelationshipRow(relationship, 'outgoing'))
                            : <div className="rounded-xl bg-white/5 p-3 text-[10px] text-text-secondary">
                                {activeRelationshipFilter === 'all'
                                  ? (isRtl ? 'لا توجد علاقات صادرة' : 'No outgoing relationships')
                                  : (isRtl ? 'لا توجد علاقات صادرة لهذا الفلتر' : 'No outgoing relationships for this filter.')}
                              </div>}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
              
              {graphView === 'dependency' && graphNodes.length > 0 ? (
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
              ) : graphView === 'dependency' ? (
                <div className="h-full flex flex-col items-center justify-center text-xs text-text-secondary space-y-3">
                  <Layers className="w-10 h-10 text-accent-blue opacity-50" />
                  <span>{t('noRelationsExtracted')}</span>
                </div>
              ) : loadingKnowledgeGraph ? (
                <div className="h-full flex flex-col items-center justify-center text-xs text-text-secondary space-y-3">
                  <div className="h-6 w-6 rounded-full border-2 border-success/30 border-t-success animate-spin"></div>
                  <span>{isRtl ? 'جار تحميل علاقات المعرفة...' : 'Loading knowledge relationships...'}</span>
                </div>
              ) : knowledgeGraphError ? (
                <div className="h-full flex flex-col items-center justify-center text-xs text-text-secondary space-y-3">
                  <GitBranch className="w-10 h-10 text-danger opacity-70" />
                  <span>{knowledgeGraphError}</span>
                  <button
                    type="button"
                    onClick={loadKnowledgeGraph}
                    className="rounded-xl border border-card-border bg-card-bg/70 px-3 py-2 text-[10px] font-bold text-white hover:bg-white/10"
                  >
                    {isRtl ? 'إعادة المحاولة' : 'Retry'}
                  </button>
                </div>
              ) : relationshipSearchTerm && filteredKnowledgeRelationships.length > 0 && searchedKnowledgeRelationships.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-xs text-text-secondary space-y-3">
                  <Layers className="w-10 h-10 text-success opacity-50" />
                  <span>{isRtl ? 'لا توجد علاقات تطابق البحث.' : 'No relationships match your search.'}</span>
                </div>
              ) : knowledgeRelationships.length > 0 && filteredKnowledgeRelationships.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-xs text-text-secondary space-y-3">
                  <Layers className="w-10 h-10 text-success opacity-50" />
                  <span>{isRtl ? 'لا توجد علاقات لهذا الفلتر.' : 'No relationships found for this filter.'}</span>
                </div>
              ) : knowledgeGraphElements.nodes.length > 0 ? (
                <ReactFlow
                  nodes={knowledgeGraphElements.nodes}
                  edges={knowledgeGraphElements.edges}
                  nodeTypes={nodeTypes}
                  onNodeClick={(_, node) => loadEntityRelationships(node)}
                  fitView
                  fitViewOptions={{ padding: 0.28 }}
                  minZoom={0.35}
                  maxZoom={1.9}
                  className="relative z-0"
                >
                  <Background color="rgba(48,209,88,0.16)" gap={26} />
                  <MiniMap
                    nodeColor={() => '#30D158'}
                    maskColor="rgba(10,10,10,0.66)"
                    className="!bg-card-bg !border !border-card-border !rounded-2xl"
                  />
                  <Controls className="!bg-card-bg !border !border-card-border !text-white !rounded-2xl !shadow-lg fill-white" />
                </ReactFlow>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-xs text-text-secondary space-y-3">
                  <Layers className="w-10 h-10 text-success opacity-50" />
                  <span>{isRtl ? 'لا توجد علاقات معرفة لهذا المشروع بعد' : 'No knowledge relationships found for this project yet.'}</span>
                  <button
                    type="button"
                    onClick={loadKnowledgeGraph}
                    className="rounded-xl border border-card-border bg-card-bg/70 px-3 py-2 text-[10px] font-bold text-white hover:bg-white/10"
                  >
                    {isRtl ? 'تحديث' : 'Refresh'}
                  </button>
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
