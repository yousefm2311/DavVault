import { Embedding, File as DBFile, CodeEntity, Snippet, ErrorSolution, ReusableSystem } from '../models';
import { aiService } from './ai.service';
import { getAccessibleProjects, isValidObjectIdString } from '../utils/access-control';

export interface SearchOptions {
  query: string;
  userId: string;
  projectId?: string;
  limit?: number;
}

export interface SearchResult {
  // Normalized fields
  id: string;
  type: string;
  domainType: string;
  title: string;
  subtitle: string;
  contentPreview: string;
  projectId?: string;
  projectName: string;
  sourceId: string;
  sourceType: string;
  score: number;
  matchReason: string;
  createdAt?: string;
  updatedAt?: string;

  // Legacy fields for backward-compatibility
  name: string;
  path: string;
  content: string;
  fileId?: string;
}

export interface SearchDebugMetadata {
  keywordMatchesCount: number;
  semanticMatchesCount: number;
  mergedCount: number;
  candidateLimit: number;
  tookMs: number;
}

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toIsoString = (value: any): string | undefined => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const normalizeLimit = (limit?: number) => {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return 15;
  return Math.min(50, Math.max(1, Math.floor(parsed)));
};

const searchError = (message: string, code: 'INVALID_OBJECT_ID' | 'PROJECT_NOT_FOUND', status: number) => {
  const error = new Error(message) as Error & { code: string; status: number };
  error.code = code;
  error.status = status;
  return error;
};

class SearchService {
  /**
   * Executes a hybrid search merging keyword regex and semantic embedding similarities.
   */
  public async search(options: SearchOptions): Promise<{ results: SearchResult[]; debug: SearchDebugMetadata }> {
    const startTime = Date.now();
    const safeQuery = String(options.query || '').trim().slice(0, 300);
    const { userId, projectId } = options;
    const limit = normalizeLimit(options.limit);

    if (!safeQuery) {
      return {
        results: [],
        debug: {
          keywordMatchesCount: 0,
          semanticMatchesCount: 0,
          mergedCount: 0,
          candidateLimit: Number(process.env.SEARCH_EMBEDDING_CANDIDATE_LIMIT) || 3000,
          tookMs: Date.now() - startTime,
        },
      };
    }

    if (projectId && !isValidObjectIdString(projectId)) {
      throw searchError('Invalid projectId.', 'INVALID_OBJECT_ID', 400);
    }

    const accessibleProjects = await getAccessibleProjects(userId, '_id userId name');
    const accessibleProjectIds = accessibleProjects.map((project: any) => project._id.toString());
    const projectNameMap = new Map(accessibleProjects.map((project: any) => [
      project._id.toString(),
      project.name || 'Untitled Project',
    ]));

    if (projectId && !accessibleProjectIds.includes(projectId)) {
      throw searchError('Project not found.', 'PROJECT_NOT_FOUND', 404);
    }

    // 1. Keyword search (regex matching)
    const queryRegex = new RegExp(escapeRegex(safeQuery), 'i');
    const projectFilter: any = projectId
      ? { projectId }
      : { projectId: { $in: accessibleProjectIds } };

    const snippetFilter: any = {
      userId,
      $or: [{ title: queryRegex }, { code: queryRegex }, { explanation: queryRegex }, { tags: queryRegex }],
    };
    if (projectId) snippetFilter.sourceProjectId = projectId;

    const errorFilter: any = {
      userId,
      $or: [{ title: queryRegex }, { errorMessage: queryRegex }, { solution: queryRegex }, { cause: queryRegex }, { tags: queryRegex }],
    };
    if (projectId) errorFilter.projectId = projectId;

    const [matchingFiles, matchingEntities, matchingSnippets, matchingErrors, matchingSystems] = await Promise.all([
      DBFile.find({ ...projectFilter, $or: [{ fileName: queryRegex }, { path: queryRegex }, { content: queryRegex }, { summary: queryRegex }] }).limit(5).lean(),
      CodeEntity.find({ ...projectFilter, name: queryRegex })
        .populate({ path: 'fileId' })
        .limit(5)
        .lean(),
      Snippet.find(snippetFilter).limit(5).lean(),
      ErrorSolution.find(errorFilter).limit(5).lean(),
      projectId
        ? Promise.resolve([])
        : ReusableSystem.find({ userId, $or: [{ name: queryRegex }, { description: queryRegex }, { tags: queryRegex }, { flow: queryRegex }] }).limit(5).lean()
    ]);

    const keywordResults: any[] = [];

    matchingFiles.forEach((f: any) => {
      keywordResults.push({
        id: f._id.toString(),
        name: f.fileName,
        type: 'file',
        domainType: 'source_asset',
        path: f.path,
        projectId: f.projectId?.toString(),
        content: String(f.content || f.summary || '').substring(0, 300),
        score: 0.65,
        matchReason: 'Keyword Match',
        createdAt: f.createdAt,
        updatedAt: f.updatedAt || f.createdAt
      });
    });

    matchingEntities.filter((e: any) => e.fileId).forEach((e: any) => {
      keywordResults.push({
        id: e._id.toString(),
        name: `${e.type}: ${e.name}`,
        type: 'codeEntity',
        domainType: 'logical_entity',
        path: e.fileId?.path || '',
        projectId: e.projectId?.toString(),
        fileId: e.fileId?._id?.toString(),
        content: String(e.code || e.summary || '').substring(0, 300),
        score: 0.7,
        matchReason: 'Keyword Match',
        createdAt: e.createdAt,
        updatedAt: e.updatedAt || e.createdAt
      });
    });

    matchingSnippets.forEach((s: any) => {
      keywordResults.push({
        id: s._id.toString(),
        name: s.title,
        type: 'snippet',
        domainType: 'code_asset',
        path: 'Snippet Library',
        projectId: s.sourceProjectId?.toString(),
        content: String(s.code || s.explanation || '').substring(0, 300),
        score: 0.65,
        matchReason: 'Keyword Match',
        createdAt: s.createdAt,
        updatedAt: s.updatedAt || s.createdAt
      });
    });

    matchingErrors.forEach((err: any) => {
      keywordResults.push({
        id: err._id.toString(),
        name: err.title,
        type: 'errorSolution',
        domainType: 'debugging_lesson',
        path: 'Error Library',
        projectId: err.projectId?.toString(),
        content: String(err.errorMessage || err.solution || '').substring(0, 300),
        score: 0.7,
        matchReason: 'Keyword Match',
        createdAt: err.createdAt,
        updatedAt: err.updatedAt || err.createdAt
      });
    });

    matchingSystems.forEach((sys: any) => {
      keywordResults.push({
        id: sys._id.toString(),
        name: sys.name,
        type: 'reusableSystem',
        domainType: 'architecture_blueprint',
        path: 'Architecture Blueprints',
        content: String(sys.description || sys.flow || '').substring(0, 300),
        score: 0.7,
        matchReason: 'Keyword Match',
        createdAt: sys.createdAt,
        updatedAt: sys.updatedAt || sys.createdAt
      });
    });

    // 2. Semantic vector search
    let queryEmbedding: number[] = [];
    try {
      queryEmbedding = await aiService.generateEmbedding(safeQuery);
    } catch (err) {
      queryEmbedding = [];
      console.error('[SearchService]: Failed to generate query embedding:', err);
    }

    const candidateLimit = Number(process.env.SEARCH_EMBEDDING_CANDIDATE_LIMIT) || 3000;
    const scoredCandidates: any[] = [];

    if (queryEmbedding && queryEmbedding.length > 0) {
      try {
        const embeddingFilter: any = projectId
          ? { projectId }
          : { $or: [{ userId }, { projectId: { $in: accessibleProjectIds } }] };

        const embeddingCandidates = await Embedding.find(embeddingFilter)
          .select('vector sourceType sourceId projectId content createdAt')
          .limit(candidateLimit)
          .lean();

        const normA = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));

        if (normA > 0) {
          for (const candidate of embeddingCandidates) {
            if (!candidate.vector || candidate.vector.length !== queryEmbedding.length) continue;

            let dotProduct = 0;
            let normB = 0;
            const vecB = candidate.vector;
            const len = vecB.length;

            for (let i = 0; i < len; i++) {
              dotProduct += queryEmbedding[i] * vecB[i];
              normB += vecB[i] * vecB[i];
            }

            if (normB === 0) continue;
            const similarity = dotProduct / (normA * Math.sqrt(normB));

            if (similarity < 0.35) continue;

            scoredCandidates.push({
              candidate,
              similarity
            });
          }
        }
      } catch (err: any) {
        console.warn(`[SearchService]: Vector candidate search failed safely. Reason: ${err?.message || 'unknown'}`);
      }
    }

    scoredCandidates.sort((a, b) => b.similarity - a.similarity);
    const topScoredCandidates = scoredCandidates.slice(0, limit * 2);
    const vectorResults: any[] = [];

    for (const item of topScoredCandidates) {
      const candidate: any = item.candidate;
      const similarity = item.similarity;

      let name = '';
      let pathStr = '';
      let fileId;
      let domainType = '';
      let contentPreview = candidate.content ? String(candidate.content).substring(0, 300) : '';
      const candidateProjectId = candidate.projectId?.toString();
      const candidateSourceId = candidate.sourceId?.toString();
      if (!candidateSourceId || !isValidObjectIdString(candidateSourceId)) continue;
      if (candidateProjectId && !accessibleProjectIds.includes(candidateProjectId)) continue;

      if (candidate.sourceType === 'file') {
        const file = await DBFile.findOne({ _id: candidate.sourceId, projectId: { $in: accessibleProjectIds } }, 'fileName path projectId').lean();
        if (file) {
          name = file.fileName;
          pathStr = file.path;
          fileId = file._id.toString();
          domainType = 'source_asset';
        }
      } else if (candidate.sourceType === 'codeEntity') {
        const entity = await CodeEntity.findOne({
          _id: candidate.sourceId,
          projectId: { $in: accessibleProjectIds }
        })
          .populate({ path: 'fileId' })
          .lean();
        if (entity) {
          name = `${entity.type}: ${entity.name}`;
          pathStr = (entity.fileId as any)?.path || '';
          fileId = (entity.fileId as any)?._id?.toString();
          domainType = 'logical_entity';
        }
      } else if (candidate.sourceType === 'snippet') {
        const snippetFilterById: any = { _id: candidate.sourceId, userId };
        if (projectId) snippetFilterById.sourceProjectId = projectId;
        const snippet = await Snippet.findOne(snippetFilterById, 'title sourceProjectId').lean();
        if (snippet) {
          name = snippet.title;
          pathStr = 'Snippet Library';
          domainType = 'code_asset';
        }
      } else if (candidate.sourceType === 'errorSolution') {
        const errorFilterById: any = { _id: candidate.sourceId, userId };
        if (projectId) errorFilterById.projectId = projectId;
        const err = await ErrorSolution.findOne(errorFilterById, 'title projectId').lean();
        if (err) {
          name = err.title;
          pathStr = 'Error Library';
          domainType = 'debugging_lesson';
        }
      } else if (!projectId && (candidate.sourceType === 'reusableSystem' || candidate.sourceType === 'architecture_blueprint')) {
        const sys = await ReusableSystem.findOne({ _id: candidate.sourceId, userId }, 'name description').lean();
        if (sys) {
          name = sys.name;
          pathStr = 'Architecture Blueprints';
          domainType = 'architecture_blueprint';
        }
      }

      if (name) {
        vectorResults.push({
          id: candidate.sourceId.toString(),
          name,
          type: candidate.sourceType === 'reusableSystem' ? 'reusableSystem' : candidate.sourceType,
          domainType: domainType || candidate.sourceType,
          path: pathStr,
          projectId: candidateProjectId,
          fileId,
          content: contentPreview,
          score: similarity,
          matchReason: 'Semantic Match',
          createdAt: candidate.createdAt,
          updatedAt: candidate.createdAt
        });
      }
    }

    // 3. Merge, deduplicate, rank
    const mergedMap = new Map<string, any>();

    vectorResults.forEach(r => {
      mergedMap.set(`${r.type}:${r.id}`, r);
    });

    keywordResults.forEach(r => {
      const existing = mergedMap.get(`${r.type}:${r.id}`);
      if (existing) {
        existing.score = Math.min(1.0, existing.score + 0.15);
        existing.matchReason = 'Hybrid Match';
      } else {
        mergedMap.set(`${r.type}:${r.id}`, r);
      }
    });

    const finalResults = Array.from(mergedMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Resolve project names and normalize response objects
    const normalizedResults: SearchResult[] = await Promise.all(
      finalResults.map(async r => {
        let projectName = 'General';
        if (r.projectId) {
          projectName = projectNameMap.get(r.projectId) || 'General';
        }

        return {
          id: r.id,
          type: r.type,
          domainType: r.domainType,
          title: r.name,
          subtitle: r.path,
          contentPreview: r.content,
          projectId: r.projectId,
          projectName,
          sourceId: r.id,
          sourceType: r.type,
          score: r.score,
          matchReason: r.matchReason,
          createdAt: toIsoString(r.createdAt),
          updatedAt: toIsoString(r.updatedAt || r.createdAt),

          // Keep legacy fields
          name: r.name,
          path: r.path,
          content: r.content,
          fileId: r.fileId
        };
      })
    );

    const tookMs = Date.now() - startTime;
    const debug: SearchDebugMetadata = {
      keywordMatchesCount: keywordResults.length,
      semanticMatchesCount: vectorResults.length,
      mergedCount: normalizedResults.length,
      candidateLimit,
      tookMs
    };

    return {
      results: normalizedResults,
      debug
    };
  }
}

export const searchService = new SearchService();
