import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { Embedding, File as DBFile, CodeEntity, Snippet, ErrorSolution, Project, ReusableSystem } from '../models';
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
    const queryRegex = new RegExp(query, 'i');
    
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
    
    // Find candidate embeddings
    const embeddingCandidates = await Embedding.find({
      userId,
      ...(projectId ? { projectId } : {})
    });

    const vectorResults: any[] = [];

    for (const candidate of embeddingCandidates) {
      const similarity = calculateCosineSimilarity(queryEmbedding, candidate.vector);
      
      // Filter out low similarity matches
      if (similarity < 0.35) continue;

      let name = '';
      let pathStr = '';
      let contentPreview = candidate.content.substring(0, 300);

      // Fetch name and details depending on source type
      if (candidate.sourceType === 'file') {
        const file = await DBFile.findById(candidate.sourceId, 'fileName path');
        if (file) {
          name = file.fileName;
          pathStr = file.path;
        }
      } else if (candidate.sourceType === 'codeEntity') {
        const entity = await CodeEntity.findById(candidate.sourceId).populate('fileId');
        if (entity) {
          name = `${entity.type}: ${entity.name}`;
          pathStr = (entity.fileId as any)?.path || '';
        }
      } else if (candidate.sourceType === 'snippet') {
        const snippet = await Snippet.findById(candidate.sourceId, 'title');
        if (snippet) {
          name = snippet.title;
          pathStr = 'Snippet Library';
        }
      } else if (candidate.sourceType === 'errorSolution') {
        const err = await ErrorSolution.findById(candidate.sourceId, 'title');
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

    const [projectsCount, filesCount, snippetsCount, errorsCount, reusableSystemsCount] = await Promise.all([
      Project.countDocuments({ userId: req.user.id }),
      DBFile.countDocuments({ userId: req.user.id }),
      Snippet.countDocuments({ userId: req.user.id }),
      ErrorSolution.countDocuments({ userId: req.user.id }),
      ReusableSystem.countDocuments({ userId: req.user.id }),
    ]);

    return res.status(200).json({
      stats: {
        projectsCount,
        filesCount,
        snippetsCount,
        errorsCount,
        reusableSystemsCount,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
