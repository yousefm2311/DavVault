/**
 * AI Context Builder Service
 *
 * Centralizes context assembly for all AI features.
 * Gathers from: embeddings (RAG), snippets, error solutions,
 * reusable systems, developer DNA (stylistic profile), and
 * recent chat history.
 *
 * Rules:
 * - Reuses searchService where possible. No duplicate search logic.
 * - Enforces per-category safe limits via env vars with safe defaults.
 * - Never exposes secrets or raw env variable values.
 * - Never throws — always returns a partial/empty context on failure.
 * - Does not replace existing fields. Purely additive.
 */

import { Types } from 'mongoose';
import {
  Activity,
  Embedding,
  File as DBFile,
  CodeEntity,
  Snippet,
  ErrorSolution,
  ReusableSystem,
  ChatSession,
  Project,
  Memory,
} from '../models';
import { searchService } from './search.service';
import { memoryService, ContextMemory } from './memory.service';
import { knowledgeGraphService, GraphRelationship } from './knowledge-graph.service';
import { KnowledgeNodeType, RelationshipType } from '../models/KnowledgeRelationship';


// ─── Safe limits ────────────────────────────────────────────────────────────
const MAX_CODE_CHUNKS   = parseInt(process.env.AI_CONTEXT_MAX_CODE_CHUNKS   || '5',  10);
const MAX_SNIPPETS      = parseInt(process.env.AI_CONTEXT_MAX_SNIPPETS      || '3',  10);
const MAX_ERRORS        = parseInt(process.env.AI_CONTEXT_MAX_ERRORS        || '3',  10);
const MAX_SYSTEMS       = parseInt(process.env.AI_CONTEXT_MAX_SYSTEMS       || '2',  10);
const MAX_MESSAGES      = parseInt(process.env.AI_CONTEXT_MAX_MESSAGES      || '10', 10);
const MAX_MEMORY        = parseInt(process.env.AI_CONTEXT_MAX_MEMORY        || '5',  10);
const MAX_RELATIONSHIPS = parseInt(process.env.AI_CONTEXT_MAX_RELATIONSHIPS || '10', 10);

const PREFERRED_EXPLAIN_RELATIONSHIP_TYPES: RelationshipType[] = [
  'defines',
  'imports',
  'calls',
  'depends_on',
  'documents',
  'solves',
];

const NODE_TYPE_LABELS: Record<KnowledgeNodeType, string> = {
  codebase: 'Codebase',
  source_asset: 'Source asset',
  logical_entity: 'Logical entity',
  code_asset: 'Code asset',
  debugging_lesson: 'Debugging lesson',
  architecture_blueprint: 'Architecture blueprint',
  memory: 'Memory',
  chat_session: 'Chat session',
  activity: 'Activity',
};

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
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



// ─── Output types ────────────────────────────────────────────────────────────

export interface ContextCodeChunk {
  path: string;
  content: string;
  score: number;
  sourceType: 'file' | 'codeEntity';
  projectId?: string;
  fileId?: string;
  entityId?: string;
}

export interface ContextSnippet {
  id: string;
  title: string;
  language: string;
  code: string;
  explanation?: string;
  tags: string[];
}

export interface ContextDebuggingLesson {
  id: string;
  title: string;
  errorMessage: string;
  cause: string;
  solution: string;
  tags: string[];
}

export interface ContextArchitectureBlueprint {
  id: string;
  name: string;
  description: string;
  type: string;
  flow?: string;
  tags: string[];
}

export interface ContextStylisticProfile {
  namingStyle: 'camelCase' | 'snake_case' | 'unknown';
  favoriteLanguage: string;
  hasErrorHandling: boolean;
  preferredAsync: boolean;
  tags: string[];
}

export interface ContextMessage {
  role: 'user' | 'assistant';
  senderName?: string;
  content: string;
}

export interface ContextCitation {
  id: string;
  type: string;
  domainType: string;
  title: string;
  subtitle?: string;
  path?: string;
  relationshipType?: string;
  confidence?: number;
  source: 'code' | 'search' | 'memory' | 'debugging_lesson' | 'architecture_blueprint' | 'knowledge_relationship';
  navigation?: {
    route?: string;
    projectId?: string;
    fileId?: string;
    entityId?: string;
  };
  fileName?: string;
  score?: number;
}

export type ContextRelationship = GraphRelationship & {
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
};

export interface AiContext {
  primaryCodeContext: ContextCodeChunk[];
  relatedSearchResults: any[];
  relatedSnippets: ContextSnippet[];
  relatedDebuggingLessons: ContextDebuggingLesson[];
  relatedArchitectureBlueprints: ContextArchitectureBlueprint[];
  stylisticProfile: ContextStylisticProfile | null;
  recentConversation: ContextMessage[];
  relevantMemory: ContextMemory[];
  relatedRelationships: ContextRelationship[];
  citations: ContextCitation[];
  contextSummary: string;
  warnings: string[];
}



/** Empty safe context — returned on any failure */
const emptyContext = (): AiContext => ({
  primaryCodeContext: [],
  relatedSearchResults: [],
  relatedSnippets: [],
  relatedDebuggingLessons: [],
  relatedArchitectureBlueprints: [],
  stylisticProfile: null,
  recentConversation: [],
  relevantMemory: [],
  relatedRelationships: [],
  citations: [],
  contextSummary: 'No context available.',
  warnings: [],
});



// ─── Cosine similarity (local, same as controller) ───────────────────────────
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot  += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const isValidObjectIdString = (value?: string): value is string => (
  typeof value === 'string' && Types.ObjectId.isValid(value)
);

// ─── Service ─────────────────────────────────────────────────────────────────

class AiContextBuilderService {

  /**
   * Build full context for AI chat.
   * Safe: never throws. On any failure returns a partial context + warning.
   */
  async buildChatContext(params: {
    userId: string;
    contextOwnerId?: string;   // owner of embeddings (may differ in workspace)
    workspaceId?: string;
    projectId?: string;
    message: string;
    sessionId?: string;
    queryEmbedding?: number[]; // pass if already computed to avoid double call
  }): Promise<AiContext> {
    const ctx = emptyContext();
    const { userId, contextOwnerId, workspaceId, projectId, message, sessionId, queryEmbedding } = params;
    const ownerId = isValidObjectIdString(contextOwnerId) ? contextOwnerId : userId;
    const scopedWorkspaceId = isValidObjectIdString(workspaceId) ? workspaceId : undefined;
    const scopedProjectId = isValidObjectIdString(projectId) ? projectId : undefined;
    const scopedSessionId = isValidObjectIdString(sessionId) ? sessionId : undefined;

    if (projectId && !scopedProjectId) {
      ctx.warnings.push('[ContextBuilder]: Ignored invalid projectId.');
    }
    if (sessionId && !scopedSessionId) {
      ctx.warnings.push('[ContextBuilder]: Ignored invalid sessionId.');
    }

    // 1. RAG: primary code context via embeddings ───────────────────────────
    try {
      if (queryEmbedding && queryEmbedding.length > 0) {
        const filter: any = { userId: ownerId };
        if (scopedProjectId) filter.projectId = scopedProjectId;

        const candidateLimit = parseInt(process.env.SEARCH_EMBEDDING_CANDIDATE_LIMIT || '3000', 10);
        const candidates = await Embedding.find(filter)
          .select('vector content sourceType sourceId projectId')
          .limit(candidateLimit)
          .lean();

        const scored = candidates
          .map(c => ({ c, score: cosineSimilarity(queryEmbedding, c.vector) }))
          .filter(({ score }) => score >= 0.35)
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_CODE_CHUNKS);

        for (const { c, score } of scored) {
          try {
            if (c.sourceType === 'file') {
              if (!isValidObjectIdString(c.sourceId?.toString())) continue;
              const fileFilter: any = { _id: c.sourceId, userId: ownerId };
              if (scopedProjectId) fileFilter.projectId = scopedProjectId;
              const file = await DBFile.findOne(fileFilter, 'fileName path').lean();
              if (file) {
                ctx.primaryCodeContext.push({
                  path: (file as any).path || (file as any).fileName,
                  content: c.content,
                  score,
                  sourceType: 'file',
                  projectId: c.projectId?.toString(),
                  fileId: c.sourceId?.toString(),
                });
              }
            } else if (c.sourceType === 'codeEntity') {
              if (!isValidObjectIdString(c.sourceId?.toString()) || !isValidObjectIdString(c.projectId?.toString())) continue;
              const entityFilter: any = { _id: c.sourceId, projectId: c.projectId };
              if (scopedProjectId) entityFilter.projectId = scopedProjectId;
              const entity = await CodeEntity.findOne(entityFilter)
                .populate('fileId', 'fileName path userId').lean();
              const fileRef = entity?.fileId as any;
              if (entity && fileRef && fileRef.userId?.toString() === ownerId) {
                ctx.primaryCodeContext.push({
                  path: fileRef.path || fileRef.fileName,
                  content: c.content,
                  score,
                  sourceType: 'codeEntity',
                  projectId: c.projectId?.toString(),
                  fileId: fileRef._id?.toString(),
                  entityId: c.sourceId?.toString(),
                });
              }
            }
          } catch (chunkErr) {
            // Skip malformed embedding reference
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.warnings.push(`[ContextBuilder]: RAG retrieval warning — ${msg}`);
    }

    // 2. Related search results (hybrid semantic+keyword) ───────────────────
    try {
      if (message && message.trim().length >= 2) {
        const { results } = await searchService.search({
          query: message,
          userId,
          projectId: scopedProjectId,
          limit: 6,
        });
        // Keep only non-code-chunk results (snippets, errors, systems) to avoid overlap
        ctx.relatedSearchResults = results.slice(0, 6);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.warnings.push(`[ContextBuilder]: Search retrieval warning — ${msg}`);
    }

    // 3. Related snippets (CodeAssets) ──────────────────────────────────────
    try {
      const snippetFilter: any = { userId };
      if (scopedProjectId) snippetFilter.sourceProjectId = scopedProjectId;

      const snippets = await Snippet.find(snippetFilter, 'title code language explanation tags')
        .sort({ updatedAt: -1 })
        .limit(MAX_SNIPPETS)
        .lean();

      ctx.relatedSnippets = snippets.map((s: any) => ({
        id: s._id.toString(),
        title: s.title,
        language: s.language,
        code: s.code.substring(0, 2000), // safe cap per snippet
        explanation: s.explanation,
        tags: s.tags || [],
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.warnings.push(`[ContextBuilder]: Snippet retrieval warning — ${msg}`);
    }

    // 4. Related debugging lessons (ErrorSolutions) ─────────────────────────
    try {
      const errorFilter: any = { userId };
      if (scopedProjectId) errorFilter.projectId = scopedProjectId;

      const lessons = await ErrorSolution.find(errorFilter, 'title errorMessage cause solution tags')
        .sort({ solvedAt: -1 })
        .limit(MAX_ERRORS)
        .lean();

      ctx.relatedDebuggingLessons = lessons.map((l: any) => ({
        id: l._id.toString(),
        title: l.title,
        errorMessage: l.errorMessage,
        cause: l.cause,
        solution: l.solution,
        tags: l.tags || [],
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.warnings.push(`[ContextBuilder]: Debugging lesson retrieval warning — ${msg}`);
    }

    // 5. Architecture blueprints (ReusableSystems) ──────────────────────────
    try {
      const systems = await ReusableSystem.find({ userId }, 'name description type flow tags')
        .sort({ updatedAt: -1 })
        .limit(MAX_SYSTEMS)
        .lean();

      ctx.relatedArchitectureBlueprints = systems.map((s: any) => ({
        id: s._id.toString(),
        name: s.name,
        description: s.description,
        type: s.type,
        flow: s.flow,
        tags: s.tags || [],
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.warnings.push(`[ContextBuilder]: Blueprint retrieval warning — ${msg}`);
    }

    // 6. Stylistic profile (derived DeveloperDNA, lightweight) ──────────────
    try {
      ctx.stylisticProfile = await this.deriveStylisticProfile(userId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.warnings.push(`[ContextBuilder]: Stylistic profile warning — ${msg}`);
    }

    // 7. Recent conversation history ────────────────────────────────────────
    try {
      if (scopedSessionId) {
        const session = await ChatSession.findOne({ _id: scopedSessionId, userId }, 'messages').lean();
        if (session && (session as any).messages) {
          const msgs = (session as any).messages as any[];
          const recent = msgs.slice(-MAX_MESSAGES);
          ctx.recentConversation = recent.map(m => ({
            role: m.sender as 'user' | 'assistant',
            senderName: m.senderName,
            content: m.text,
          }));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.warnings.push(`[ContextBuilder]: Conversation history warning — ${msg}`);
    }

    // 8. Relevant developer memory ────────────────────────────────────────────
    try {
      const memories = await memoryService.findRelevantMemory({
        userId,
        workspaceId: scopedWorkspaceId,
        projectId: scopedProjectId,
        limit: MAX_MEMORY,
      });
      ctx.relevantMemory = memories;

      // Fire-and-forget usage tracking — must not block context assembly
      if (memories.length > 0) {
        memoryService.incrementUsage(memories.map((m) => m.id)).catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.warnings.push(`[ContextBuilder]: Memory retrieval warning — ${msg}`);
    }

    // 9. Project knowledge graph relationships ──────────────────────────────
    // Uses project-scoped, MongoDB-only graph relationships. Relevance ranking
    // is local and capped, so graph failure never blocks chat.
    try {
      if (scopedProjectId) {
        const neighborhood = await knowledgeGraphService.findNeighborhood({
          userId: ownerId,
          entityType: 'codebase',
          entityId: scopedProjectId,
          depth: 2,
          limit: Math.max(MAX_RELATIONSHIPS * 4, MAX_RELATIONSHIPS),
        });

        const relationships = this.dedupeRelationships([
          ...neighborhood.outgoing,
          ...neighborhood.incoming,
        ]);

        const enriched = await this.enrichRelationships(ownerId, relationships);
        ctx.relatedRelationships = this.rankRelationshipsForQuery(enriched, message)
          .slice(0, MAX_RELATIONSHIPS);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.warnings.push(`[ContextBuilder]: Graph relationship warning — ${msg}`);
    }

    // 10. Build normalized safe citations ───────────────────────────────────
    ctx.citations = this.buildCitations(ctx);

    // 11. Build context summary ──────────────────────────────────────────────
    ctx.contextSummary = this.buildSummary(ctx);

    return ctx;
  }

  /**
   * Build context for explain-code requests.
   * Safe: never throws.
   */
  async buildExplainCodeContext(params: {
    userId: string;
    contextOwnerId?: string;
    workspaceId?: string;
    projectId?: string;
    fileId?: string;
    code: string;
    language: string;
  }): Promise<AiContext> {
    const ctx = emptyContext();
    const { userId, contextOwnerId, workspaceId, projectId, fileId, language } = params;
    const ownerId = isValidObjectIdString(contextOwnerId) ? contextOwnerId : userId;
    const scopedWorkspaceId = isValidObjectIdString(workspaceId) ? workspaceId : undefined;
    const scopedProjectId = isValidObjectIdString(projectId) ? projectId : undefined;
    const scopedFileId = isValidObjectIdString(fileId) ? fileId : undefined;

    if (projectId && !scopedProjectId) {
      ctx.warnings.push('[ContextBuilder/Explain]: Ignored invalid projectId.');
    }
    if (fileId && !scopedFileId) {
      ctx.warnings.push('[ContextBuilder/Explain]: Ignored invalid fileId.');
    }

    // 0. Selected source file citation seed ─────────────────────────────────
    try {
      if (scopedFileId) {
        const fileFilter: any = { _id: scopedFileId, userId: ownerId };
        if (scopedProjectId) fileFilter.projectId = scopedProjectId;
        const file = await DBFile.findOne(fileFilter, 'path fileName').lean();
        if (file) {
          ctx.primaryCodeContext.push({
            path: (file as any).path || (file as any).fileName,
            content: '',
            score: 1,
            sourceType: 'file',
            projectId: scopedProjectId,
            fileId: scopedFileId,
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.warnings.push(`[ContextBuilder/Explain]: Source file citation warning — ${msg}`);
    }

    // 1. Related snippets for same language ─────────────────────────────────
    try {
      const snippets = await Snippet.find({ userId, language }, 'title code language explanation tags')
        .sort({ updatedAt: -1 })
        .limit(MAX_SNIPPETS)
        .lean();

      ctx.relatedSnippets = snippets.map((s: any) => ({
        id: s._id.toString(),
        title: s.title,
        language: s.language,
        code: s.code.substring(0, 2000),
        explanation: s.explanation,
        tags: s.tags || [],
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.warnings.push(`[ContextBuilder/Explain]: Snippet retrieval warning — ${msg}`);
    }

    // 2. Debugging lessons ──────────────────────────────────────────────────
    try {
      const errorFilter: any = { userId };
      if (scopedProjectId) errorFilter.projectId = scopedProjectId;

      const lessons = await ErrorSolution.find(errorFilter, 'title errorMessage cause solution tags')
        .sort({ solvedAt: -1 })
        .limit(MAX_ERRORS)
        .lean();

      ctx.relatedDebuggingLessons = lessons.map((l: any) => ({
        id: l._id.toString(),
        title: l.title,
        errorMessage: l.errorMessage,
        cause: l.cause,
        solution: l.solution,
        tags: l.tags || [],
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.warnings.push(`[ContextBuilder/Explain]: Debugging lesson warning — ${msg}`);
    }

    // 3. Architecture blueprints ─────────────────────────────────────────────
    try {
      const systems = await ReusableSystem.find({ userId }, 'name description type flow tags')
        .sort({ updatedAt: -1 })
        .limit(MAX_SYSTEMS)
        .lean();

      ctx.relatedArchitectureBlueprints = systems.map((s: any) => ({
        id: s._id.toString(),
        name: s.name,
        description: s.description,
        type: s.type,
        flow: s.flow,
        tags: s.tags || [],
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.warnings.push(`[ContextBuilder/Explain]: Blueprint warning — ${msg}`);
    }

    // 4. Stylistic profile ──────────────────────────────────────────────────
    try {
      ctx.stylisticProfile = await this.deriveStylisticProfile(userId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.warnings.push(`[ContextBuilder/Explain]: Stylistic profile warning — ${msg}`);
    }

    // 5. Relevant developer memory ─────────────────────────────────────────
    try {
      const memories = await memoryService.findRelevantMemory({
        userId,
        workspaceId: scopedWorkspaceId,
        projectId: scopedProjectId,
        limit: MAX_MEMORY,
      });
      ctx.relevantMemory = memories;
      if (memories.length > 0) {
        memoryService.incrementUsage(memories.map((m) => m.id)).catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.warnings.push(`[ContextBuilder/Explain]: Memory retrieval warning — ${msg}`);
    }

    // 6. Knowledge graph relationships (direct only, depth=1) ────────────────
    // Includes incoming and outgoing relationships for the selected file/entity
    // when available, with explain-code relationship types preferred.
    // Does not traverse deep graph. Safe: failure is isolated.
    try {
      let relationships: GraphRelationship[] = [];
      if (scopedFileId) {
        const neighborhood = await knowledgeGraphService.findNeighborhood({
          userId: ownerId,
          entityType: 'source_asset',
          entityId:   scopedFileId,
          depth:      1,
          limit:      Math.max(MAX_RELATIONSHIPS * 2, MAX_RELATIONSHIPS),
        });
        relationships = [
          ...neighborhood.outgoing,
          ...neighborhood.incoming,
        ];
      } else if (scopedProjectId) {
        // Fallback: fetch outgoing relationships from the codebase node itself
        const outgoing = await knowledgeGraphService.findOutgoing({
          userId: ownerId,
          sourceType: 'codebase',
          sourceId:   scopedProjectId,
          limit:      Math.max(MAX_RELATIONSHIPS * 2, MAX_RELATIONSHIPS),
        });
        relationships = outgoing;
      }

      const enriched = await this.enrichRelationships(ownerId, this.dedupeRelationships(relationships));
      ctx.relatedRelationships = this.prioritizeExplainRelationships(enriched)
        .slice(0, MAX_RELATIONSHIPS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.warnings.push(`[ContextBuilder/Explain]: Graph relationship warning — ${msg}`);
    }

    ctx.citations = this.buildCitations(ctx);
    ctx.contextSummary = this.buildSummary(ctx);
    return ctx;
  }

  /**
   * Builds safe source citations for UI display. Citations intentionally omit
   * full code, prompt text, memory content, and raw search result bodies.
   */
  private buildCitations(ctx: AiContext): ContextCitation[] {
    const citations: ContextCitation[] = [];

    ctx.primaryCodeContext.forEach((chunk, index) => {
      citations.push({
        id: `code:${chunk.path || index}`,
        type: chunk.sourceType,
        domainType: chunk.sourceType === 'codeEntity' ? 'logical_entity' : 'source_asset',
        title: this.safeCitationText(this.basename(chunk.path) || chunk.path || 'Code context') || 'Code context',
        subtitle: chunk.sourceType === 'codeEntity' ? 'Logical entity context' : 'Source file context',
        path: this.safeCitationText(chunk.path),
        confidence: chunk.score,
        score: chunk.score,
        source: 'code',
        navigation: this.buildCitationNavigation({
          domainType: chunk.sourceType === 'codeEntity' ? 'logical_entity' : 'source_asset',
          projectId: chunk.projectId,
          fileId: chunk.fileId,
          entityId: chunk.entityId,
        }),
        fileName: this.safeCitationText(this.basename(chunk.path) || chunk.path),
      });
    });

    ctx.relatedSearchResults.forEach((result: any) => {
      citations.push({
        id: `search:${result.id || result.sourceId || result.path || result.name}`,
        type: result.type || result.sourceType || 'search_result',
        domainType: result.domainType || result.type || 'search_result',
        title: this.safeCitationText(result.title || result.name || 'Search result') || 'Search result',
        subtitle: this.safeCitationText(result.subtitle || result.matchReason || result.projectName),
        path: this.safeCitationText(result.path),
        confidence: typeof result.score === 'number' ? result.score : undefined,
        score: typeof result.score === 'number' ? result.score : undefined,
        source: 'search',
        navigation: this.buildCitationNavigation({
          domainType: result.domainType || result.type,
          id: result.id || result.sourceId,
          projectId: result.projectId,
          fileId: result.fileId || (result.domainType === 'source_asset' ? result.id : undefined),
          entityId: result.domainType === 'logical_entity' ? result.id : undefined,
        }),
        fileName: this.safeCitationText(result.title || result.name || result.path),
      });
    });

    ctx.relatedSnippets.forEach((snippet) => {
      citations.push({
        id: `snippet:${snippet.id}`,
        type: 'snippet',
        domainType: 'code_asset',
        title: this.safeCitationText(snippet.title) || 'Code asset',
        subtitle: this.safeCitationText(snippet.language),
        path: 'Snippet Library',
        source: 'search',
        navigation: this.buildCitationNavigation({ domainType: 'code_asset', id: snippet.id }),
        fileName: this.safeCitationText(snippet.title),
      });
    });

    ctx.relatedDebuggingLessons.forEach((lesson) => {
      citations.push({
        id: `debugging_lesson:${lesson.id}`,
        type: 'debugging_lesson',
        domainType: 'debugging_lesson',
        title: this.safeCitationText(lesson.title) || 'Debugging lesson',
        subtitle: this.safeCitationText(lesson.errorMessage),
        path: 'Debugging Lessons',
        source: 'debugging_lesson',
        navigation: this.buildCitationNavigation({ domainType: 'debugging_lesson', id: lesson.id }),
        fileName: this.safeCitationText(lesson.title),
      });
    });

    ctx.relatedArchitectureBlueprints.forEach((blueprint) => {
      citations.push({
        id: `architecture_blueprint:${blueprint.id}`,
        type: 'architecture_blueprint',
        domainType: 'architecture_blueprint',
        title: this.safeCitationText(blueprint.name) || 'Architecture blueprint',
        subtitle: this.safeCitationText(blueprint.type),
        path: 'Architecture Blueprints',
        source: 'architecture_blueprint',
        navigation: this.buildCitationNavigation({ domainType: 'architecture_blueprint', id: blueprint.id }),
        fileName: this.safeCitationText(blueprint.name),
      });
    });

    ctx.relevantMemory.forEach((memory) => {
      citations.push({
        id: `memory:${memory.id}`,
        type: memory.type,
        domainType: 'memory',
        title: this.safeCitationText(memory.title) || 'Memory',
        subtitle: this.safeCitationText(memory.scope),
        confidence: memory.confidence,
        source: 'memory',
        fileName: this.safeCitationText(memory.title),
      });
    });

    ctx.relatedRelationships.forEach((relationship) => {
      const title = relationship.displayName ||
        `${relationship.sourceDisplayName || relationship.sourceType} -> ${relationship.targetDisplayName || relationship.targetType}`;
      citations.push({
        id: `knowledge_relationship:${relationship.id}`,
        type: 'knowledge_relationship',
        domainType: 'knowledge_relationship',
        title: this.safeCitationText(title) || 'Knowledge relationship',
        subtitle: this.safeCitationText(relationship.displaySubtitle),
        path: this.safeCitationText(relationship.sourcePath || relationship.targetPath),
        relationshipType: relationship.relationshipType,
        confidence: relationship.confidence,
        source: 'knowledge_relationship',
        fileName: this.safeCitationText(title),
      });
    });

    const seen = new Set<string>();
    return citations.filter((citation) => {
      const key = `${citation.source}:${citation.id}:${citation.path || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 30);
  }

  private safeCitationText(value?: string): string | undefined {
    if (!value || typeof value !== 'string') return undefined;
    const secretPatterns = [
      /\b(password|secret|api[_-]?key|token)\s*[:=]\s*[^\s,;]+/gi,
      /\bbearer\s+[a-zA-Z0-9._\-]{12,}/gi,
      /\bsk-[a-zA-Z0-9]{12,}/g,
      /\bAIza[a-zA-Z0-9_\-]{20,}/g,
      /process\.env\.\w+/g,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    ];
    let safe = value;
    secretPatterns.forEach((pattern) => {
      safe = safe.replace(pattern, '[REDACTED]');
    });
    safe = safe.replace(/[\r\n\t]+/g, ' ').trim();
    if (!safe) return undefined;
    return safe.length > 240 ? `${safe.substring(0, 240)}...` : safe;
  }

  private buildCitationNavigation(input: {
    domainType?: string;
    id?: string;
    projectId?: string;
    fileId?: string;
    entityId?: string;
  }): ContextCitation['navigation'] | undefined {
    const { domainType, id, projectId, fileId, entityId } = input;
    const safeId = isValidObjectIdString(id) ? id : undefined;
    const safeProjectId = isValidObjectIdString(projectId) ? projectId : undefined;
    const safeFileId = isValidObjectIdString(fileId) ? fileId : undefined;
    const safeEntityId = isValidObjectIdString(entityId) ? entityId : undefined;

    if ((domainType === 'source_asset' || domainType === 'logical_entity') && safeProjectId) {
      const route = safeFileId ? `/projects/${safeProjectId}?fileId=${safeFileId}` : `/projects/${safeProjectId}`;
      return {
        route,
        projectId: safeProjectId,
        fileId: safeFileId,
        entityId: safeEntityId,
      };
    }
    if (domainType === 'code_asset' && safeId) {
      return { route: `/snippets?id=${safeId}`, entityId: safeId };
    }
    if (domainType === 'debugging_lesson' && safeId) {
      return { route: `/errors?id=${safeId}`, entityId: safeId };
    }
    if (domainType === 'architecture_blueprint' && safeId) {
      return { route: `/systems?id=${safeId}`, entityId: safeId };
    }
    return undefined;
  }

  private basename(value?: string): string {
    if (!value) return '';
    return value.split(/[\\/]/).filter(Boolean).pop() || value;
  }

  /**
   * Deduplicates relationship lists assembled from incoming/outgoing graph reads.
   */
  private dedupeRelationships(relationships: GraphRelationship[]): GraphRelationship[] {
    const seen = new Set<string>();
    const deduped: GraphRelationship[] = [];

    for (const relationship of relationships) {
      const key = relationship.id ||
        `${relationship.sourceType}:${relationship.sourceId}:${relationship.relationshipType}:${relationship.targetType}:${relationship.targetId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(relationship);
    }

    return deduped;
  }

  /**
   * Adds readable labels/paths for AI prompts. This is intentionally local to
   * the context builder and fails closed to raw graph fields.
   */
  private async enrichRelationships(userId: string, relationships: GraphRelationship[]): Promise<ContextRelationship[]> {
    const cache = new Map<string, Promise<{
      displayName: string;
      displayType: string;
      displaySubtitle?: string;
      path?: string;
    }>>();

    const getDisplay = (entityType: KnowledgeNodeType, entityId: string) => {
      const key = `${entityType}:${entityId}`;
      if (!cache.has(key)) {
        cache.set(key, this.resolveRelationshipNodeDisplay(userId, entityType, entityId));
      }
      return cache.get(key)!;
    };

    return Promise.all(relationships.map(async (relationship) => {
      const [source, target] = await Promise.all([
        getDisplay(relationship.sourceType, relationship.sourceId),
        getDisplay(relationship.targetType, relationship.targetId),
      ]);
      const displayType = RELATIONSHIP_LABELS[relationship.relationshipType] ||
        relationship.relationshipType ||
        'Related to';

      return {
        ...relationship,
        displayName: `${source.displayName} ${displayType.toLowerCase()} ${target.displayName}`,
        displayType,
        displaySubtitle: `${source.displayType} -> ${target.displayType}`,
        sourceDisplayName: source.displayName,
        targetDisplayName: target.displayName,
        sourceDisplayType: source.displayType,
        targetDisplayType: target.displayType,
        sourceDisplaySubtitle: source.displaySubtitle,
        targetDisplaySubtitle: target.displaySubtitle,
        sourcePath: source.path,
        targetPath: target.path,
      };
    }));
  }

  private async resolveRelationshipNodeDisplay(
    userId: string,
    entityType: KnowledgeNodeType,
    entityId: string
  ): Promise<{ displayName: string; displayType: string; displaySubtitle?: string; path?: string }> {
    const fallback = {
      displayName: `${NODE_TYPE_LABELS[entityType] || entityType} ${entityId.slice(-8)}`,
      displayType: NODE_TYPE_LABELS[entityType] || entityType,
      displaySubtitle: 'Entity unavailable or deleted',
    };

    try {
      if (!Types.ObjectId.isValid(entityId)) return fallback;
      const _id = new Types.ObjectId(entityId);

      switch (entityType) {
        case 'codebase': {
          const project = await Project.findOne({ _id, userId }, 'name language framework').lean();
          if (!project) return fallback;
          return {
            displayName: (project as any).name || 'Untitled project',
            displayType: 'Codebase',
            displaySubtitle: [(project as any).language, (project as any).framework].filter(Boolean).join(' · ') || undefined,
          };
        }
        case 'source_asset': {
          const file = await DBFile.findOne({ _id, userId }, 'path fileName language extension').lean();
          if (!file) return fallback;
          return {
            displayName: (file as any).fileName || (file as any).path || 'Source file',
            displayType: 'Source asset',
            displaySubtitle: (file as any).path,
            path: (file as any).path,
          };
        }
        case 'logical_entity': {
          const entity = await CodeEntity.findById(_id, 'name type fileId')
            .populate('fileId', 'path fileName userId')
            .lean();
          const fileRef = (entity as any)?.fileId;
          if (!entity || (fileRef?.userId && fileRef.userId.toString() !== userId)) return fallback;
          return {
            displayName: (entity as any).name || 'Code entity',
            displayType: (entity as any).type || 'Logical entity',
            displaySubtitle: fileRef?.path || fileRef?.fileName,
            path: fileRef?.path,
          };
        }
        case 'code_asset': {
          const snippet = await Snippet.findOne({ _id, userId }, 'title language').lean();
          if (!snippet) return fallback;
          return {
            displayName: (snippet as any).title || 'Code asset',
            displayType: 'Code asset',
            displaySubtitle: (snippet as any).language,
          };
        }
        case 'debugging_lesson': {
          const lesson = await ErrorSolution.findOne({ _id, userId }, 'title errorMessage').lean();
          if (!lesson) return fallback;
          return {
            displayName: (lesson as any).title || 'Debugging lesson',
            displayType: 'Debugging lesson',
            displaySubtitle: (lesson as any).errorMessage,
          };
        }
        case 'architecture_blueprint': {
          const system = await ReusableSystem.findOne({ _id, userId }, 'name type').lean();
          if (!system) return fallback;
          return {
            displayName: (system as any).name || 'Architecture blueprint',
            displayType: 'Architecture blueprint',
            displaySubtitle: (system as any).type,
          };
        }
        case 'memory': {
          const memory = await Memory.findOne({ _id, userId }, 'title type scope').lean();
          if (!memory) return fallback;
          return {
            displayName: (memory as any).title || 'Memory',
            displayType: 'Memory',
            displaySubtitle: [(memory as any).type, (memory as any).scope].filter(Boolean).join(' · ') || undefined,
          };
        }
        case 'chat_session': {
          const session = await ChatSession.findOne({ _id, userId }, 'title projectId').lean();
          if (!session) return fallback;
          return {
            displayName: (session as any).title || 'Chat session',
            displayType: 'Chat session',
            displaySubtitle: (session as any).projectId ? `Project ${(session as any).projectId.toString().slice(-8)}` : undefined,
          };
        }
        case 'activity': {
          const activity = await Activity.findOne({ _id, userId }, 'action entityType metadata').lean();
          if (!activity) return fallback;
          return {
            displayName: (activity as any).metadata?.title || (activity as any).metadata?.projectName || (activity as any).action || 'Activity',
            displayType: 'Activity',
            displaySubtitle: (activity as any).entityType,
          };
        }
        default:
          return fallback;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ContextBuilder]: relationship display resolution warning — ${msg}`);
      return fallback;
    }
  }

  private rankRelationshipsForQuery(
    relationships: ContextRelationship[],
    query: string
  ): ContextRelationship[] {
    const tokens = this.extractQueryTokens(query);
    if (tokens.length === 0) {
      return relationships
        .slice()
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    }

    return relationships
      .map((relationship) => ({
        relationship,
        score: this.relationshipRelevanceScore(relationship, tokens),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ relationship }) => relationship);
  }

  private relationshipRelevanceScore(relationship: ContextRelationship, tokens: string[]): number {
    const fields = [
      relationship.displayName,
      relationship.displayType,
      relationship.displaySubtitle,
      relationship.sourceDisplayName,
      relationship.targetDisplayName,
      relationship.sourceDisplaySubtitle,
      relationship.targetDisplaySubtitle,
      relationship.sourcePath,
      relationship.targetPath,
      relationship.relationshipType,
      relationship.evidence?.reason,
      relationship.evidence?.snippet,
      relationship.evidence?.filePath,
    ].filter(Boolean).join(' ').toLowerCase();

    let score = relationship.confidence || 0;
    for (const token of tokens) {
      if (fields.includes(token)) score += 2;
      if ((relationship.relationshipType || '').toLowerCase() === token) score += 3;
    }
    return score;
  }

  private extractQueryTokens(query: string): string[] {
    return query
      .toLowerCase()
      .split(/[^a-z0-9_./-]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
      .slice(0, 24);
  }

  private prioritizeExplainRelationships(relationships: ContextRelationship[]): ContextRelationship[] {
    return relationships.slice().sort((a, b) => {
      const aPriority = PREFERRED_EXPLAIN_RELATIONSHIP_TYPES.includes(a.relationshipType) ? 1 : 0;
      const bPriority = PREFERRED_EXPLAIN_RELATIONSHIP_TYPES.includes(b.relationshipType) ? 1 : 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      return (b.confidence || 0) - (a.confidence || 0);
    });
  }

  /**
   * Derives a lightweight stylistic profile from the user's file contents.
   * Does NOT store anything. Purely read-only, derived on demand.
   * Safe limit: reads at most 20 files, 500 chars of content each.
   */
  private async deriveStylisticProfile(userId: string): Promise<ContextStylisticProfile | null> {
    const files = await DBFile.find({ userId }, 'content language extension')
      .limit(20)
      .lean();

    if (!files || files.length === 0) return null;

    let camel = 0, snake = 0;
    let hasAsync = false;
    let hasErrorHandling = false;
    const langCounts: Record<string, number> = {};

    for (const file of files) {
      const sample = ((file as any).content || '').substring(0, 500);
      camel += (sample.match(/[a-z]+[A-Z][a-zA-Z0-9]*/g) || []).length;
      snake += (sample.match(/[a-z]+_[a-z0-9_]+/g) || []).length;
      if (sample.includes('async') || sample.includes('await')) hasAsync = true;
      if (sample.includes('try') || sample.includes('catch')) hasErrorHandling = true;

      const lang = (file as any).language || (file as any).extension || 'unknown';
      langCounts[lang] = (langCounts[lang] || 0) + 1;
    }

    const favoriteLanguage = Object.entries(langCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    const namingStyle: 'camelCase' | 'snake_case' | 'unknown' =
      camel > snake ? 'camelCase' : snake > camel ? 'snake_case' : 'unknown';

    const tags: string[] = [];
    if (hasErrorHandling) tags.push('Robust Error Handling');
    if (hasAsync) tags.push('Async/Await Pattern');
    if (namingStyle !== 'unknown') tags.push(`${namingStyle} Naming`);

    return { namingStyle, favoriteLanguage, hasErrorHandling, preferredAsync: hasAsync, tags };
  }

  /**
   * Builds a human-readable summary of what context was gathered.
   * Used to inject into the AI system prompt.
   */
  private buildSummary(ctx: AiContext): string {
    const parts: string[] = [];
    if (ctx.primaryCodeContext.length > 0)
      parts.push(`${ctx.primaryCodeContext.length} code chunk(s) from the codebase`);
    if (ctx.relatedSnippets.length > 0)
      parts.push(`${ctx.relatedSnippets.length} saved code asset(s)`);
    if (ctx.relatedDebuggingLessons.length > 0)
      parts.push(`${ctx.relatedDebuggingLessons.length} debugging lesson(s)`);
    if (ctx.relatedArchitectureBlueprints.length > 0)
      parts.push(`${ctx.relatedArchitectureBlueprints.length} architecture blueprint(s)`);
    if (ctx.stylisticProfile)
      parts.push(`stylistic profile (${ctx.stylisticProfile.namingStyle}, ${ctx.stylisticProfile.favoriteLanguage})`);
    if (ctx.recentConversation.length > 0)
      parts.push(`${ctx.recentConversation.length} recent message(s)`);
    if (ctx.relevantMemory && ctx.relevantMemory.length > 0)
      parts.push(`${ctx.relevantMemory.length} developer memory record(s)`);
    if (ctx.relatedRelationships && ctx.relatedRelationships.length > 0) {
      const typeCounts = new Map<string, number>();
      const connectedEntities = new Map<string, number>();

      ctx.relatedRelationships.forEach((relationship) => {
        const typeLabel = relationship.displayType ||
          RELATIONSHIP_LABELS[relationship.relationshipType] ||
          relationship.relationshipType;
        typeCounts.set(typeLabel, (typeCounts.get(typeLabel) || 0) + 1);

        const sourceLabel = relationship.sourceDisplayName || `${relationship.sourceType}:${relationship.sourceId.slice(-8)}`;
        const targetLabel = relationship.targetDisplayName || `${relationship.targetType}:${relationship.targetId.slice(-8)}`;
        connectedEntities.set(sourceLabel, (connectedEntities.get(sourceLabel) || 0) + 1);
        connectedEntities.set(targetLabel, (connectedEntities.get(targetLabel) || 0) + 1);
      });

      const commonTypes = Array.from(typeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([type, count]) => `${type} (${count})`)
        .join(', ');
      const relevantEntities = Array.from(connectedEntities.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([entity]) => entity)
        .join(', ');

      parts.push(
        `${ctx.relatedRelationships.length} knowledge graph relationship(s)` +
        `${commonTypes ? `; common types: ${commonTypes}` : ''}` +
        `${relevantEntities ? `; connected entities: ${relevantEntities}` : ''}`
      );
    }

    if (parts.length === 0) return 'No enriched context available for this request.';
    return `Context includes: ${parts.join(', ')}.`;
  }
}

export const aiContextBuilder = new AiContextBuilderService();
