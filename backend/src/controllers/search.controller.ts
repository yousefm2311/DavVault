import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { Activity, Embedding, File as DBFile, CodeEntity, Snippet, ErrorSolution, Project, ReusableSystem } from '../models';
import { aiService } from '../services/ai.service';

// Utility: Compute Cosine Similarity between two arrays of numbers
const calculateCosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const searchHybrid = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    
    const { query, projectId } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required.' });
    }

    const userId = req.user.id;
    const limit = Number(req.body.limit) || 15;

    // 1. Keyword search (regex match content and titles)
    const queryRegex = new RegExp(escapeRegex(query), 'i');
    
    // Project filter
    const projectFilter: any = projectId ? { projectId } : {};
    
    // Search DB models for keywords
    const [matchingFiles, matchingEntities, matchingSnippets, matchingErrors] = await Promise.all([
      DBFile.find({ userId, ...projectFilter, $or: [{ fileName: queryRegex }, { content: queryRegex }] }).limit(5),
      CodeEntity.find({ ...projectFilter, name: queryRegex }).populate('fileId').limit(5),
      Snippet.find({ userId, $or: [{ title: queryRegex }, { code: queryRegex }] }).limit(5),
      ErrorSolution.find({ userId, $or: [{ title: queryRegex }, { errorMessage: queryRegex }, { solution: queryRegex }] }).limit(5)
    ]);

    // Build keyword search matches
    const keywordResults: any[] = [];
    
    matchingFiles.forEach(f => {
      keywordResults.push({
        id: f._id,
        name: f.fileName,
        type: 'file',
        path: f.path,
        projectId: f.projectId,
        content: f.content.substring(0, 300),
        score: 0.65, // Base score for regex match
        createdAt: f.createdAt
      });
    });

    matchingEntities.forEach((e: any) => {
      keywordResults.push({
        id: e._id,
        name: `${e.type}: ${e.name}`,
        type: 'codeEntity',
        path: e.fileId?.path || '',
        projectId: e.projectId,
        fileId: e.fileId?._id,
        content: e.code.substring(0, 300),
        score: 0.7,
        createdAt: e.createdAt
      });
    });

    matchingSnippets.forEach(s => {
      keywordResults.push({
        id: s._id,
        name: s.title,
        type: 'snippet',
        path: 'Snippet Library',
        projectId: s.sourceProjectId,
        content: s.code.substring(0, 300),
        score: 0.65,
        createdAt: s.createdAt
      });
    });

    matchingErrors.forEach(err => {
      keywordResults.push({
        id: err._id,
        name: err.title,
        type: 'errorSolution',
        path: 'Error Library',
        projectId: err.projectId,
        content: err.errorMessage.substring(0, 300),
        score: 0.7,
        createdAt: err.createdAt
      });
    });

    // 2. Semantic vector search (generate query embedding and run local cosine similarity)
    const queryEmbedding = await aiService.generateEmbedding(query);
    
    // Find candidate embeddings using lean() for maximum performance and select only required fields
    const embeddingCandidates = await Embedding.find({
      userId,
      ...(projectId ? { projectId } : {})
    })
      .select('vector sourceType sourceId projectId content createdAt')
      .limit(3000)
      .lean();

    // Precompute query vector norm once
    const normA = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));

    const scoredCandidates: any[] = [];

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
        
        // Filter out low similarity matches
        if (similarity < 0.35) continue;

        scoredCandidates.push({
          candidate,
          similarity
        });
      }
    }

    // Sort by similarity descending
    scoredCandidates.sort((a, b) => b.similarity - a.similarity);

    // Limit lookups to top (limit * 2) candidates to prevent blocking/timeouts
    const topScoredCandidates = scoredCandidates.slice(0, limit * 2);

    const vectorResults: any[] = [];
    for (const item of topScoredCandidates) {
      const candidate = item.candidate;
      const similarity = item.similarity;

      let name = '';
      let pathStr = '';
      let fileId;
      let contentPreview = candidate.content ? candidate.content.substring(0, 300) : '';

      // Fetch name and details depending on source type
      if (candidate.sourceType === 'file') {
        const file = await DBFile.findById(candidate.sourceId, 'fileName path').lean();
        if (file) {
          name = file.fileName;
          pathStr = file.path;
          fileId = file._id;
        }
      } else if (candidate.sourceType === 'codeEntity') {
        const entity = await CodeEntity.findById(candidate.sourceId).populate('fileId').lean();
        if (entity) {
          name = `${entity.type}: ${entity.name}`;
          pathStr = (entity.fileId as any)?.path || '';
          fileId = (entity.fileId as any)?._id;
        }
      } else if (candidate.sourceType === 'snippet') {
        const snippet = await Snippet.findById(candidate.sourceId, 'title').lean();
        if (snippet) {
          name = snippet.title;
          pathStr = 'Snippet Library';
        }
      } else if (candidate.sourceType === 'errorSolution') {
        const err = await ErrorSolution.findById(candidate.sourceId, 'title').lean();
        if (err) {
          name = err.title;
          pathStr = 'Error Library';
        }
      }

      if (name) {
        vectorResults.push({
          id: candidate.sourceId,
          name,
          type: candidate.sourceType,
          path: pathStr,
          projectId: candidate.projectId,
          fileId,
          content: contentPreview,
          score: similarity,
          createdAt: candidate.createdAt
        });
      }
    }

    // 3. Merge, sort, deduplicate
    const mergedMap = new Map<string, any>();
    
    // Add vector results first
    vectorResults.forEach(r => {
      mergedMap.set(r.id.toString(), r);
    });

    // Merge in keyword results (boosting scores if matched by both)
    keywordResults.forEach(r => {
      const key = r.id.toString();
      const existing = mergedMap.get(key);
      if (existing) {
        // Boost similarity score
        existing.score = Math.min(1.0, existing.score + 0.15);
      } else {
        mergedMap.set(key, r);
      }
    });

    const finalResults = Array.from(mergedMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Attach Project Name to results for frontend display
    const finalResultsWithProjects = await Promise.all(
      finalResults.map(async r => {
        if (r.projectId) {
          const project = await Project.findById(r.projectId, 'name');
          return { ...r, projectName: project ? project.name : 'Unknown' };
        }
        return { ...r, projectName: 'General' };
      })
    );

    return res.status(200).json({ results: finalResultsWithProjects });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
export const getQuickStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [projectsCount, filesCount, snippetsCount, errorsCount, reusableSystemsCount, aiQueriesCount] = await Promise.all([
      Project.countDocuments({ userId: req.user.id }),
      DBFile.countDocuments({ userId: req.user.id }),
      Snippet.countDocuments({ userId: req.user.id }),
      ErrorSolution.countDocuments({ userId: req.user.id }),
      ReusableSystem.countDocuments({ userId: req.user.id }),
      Activity.countDocuments({ userId: req.user.id, action: 'ai_question', createdAt: { $gte: startOfMonth } }),
    ]);

    return res.status(200).json({
      stats: {
        projectsCount,
        filesCount,
        snippetsCount,
        errorsCount,
        reusableSystemsCount,
        aiQueriesCount,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
