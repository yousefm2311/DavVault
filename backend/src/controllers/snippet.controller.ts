import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { Snippet, Embedding, Activity, File as DBFile } from '../models';
import { aiService } from '../services/ai.service';
import { findAccessibleProject, isValidObjectIdString } from '../utils/access-control';

const invalidIdResponse = (res: Response, field: string) => res.status(400).json({
  error: `Invalid ${field}.`,
  code: 'INVALID_OBJECT_ID',
});

const serverErrorResponse = (res: Response, code: string) => res.status(500).json({
  error: 'An unexpected snippet API error occurred.',
  code,
});

const buildSnippetEmbeddingText = (title: string, language: string, code: string, explanation = '') => (
  `${title}\n${language}\n${code.slice(0, 15000)}\n${explanation.slice(0, 2000)}`
);

const unsupportedWorkspaceScopeResponse = (res: Response) => res.status(400).json({
  error: 'Snippet library records are user-private and do not support workspace filtering.',
  code: 'WORKSPACE_SCOPE_UNSUPPORTED',
});

export const createSnippet = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { title, code, language, explanation, tags, sourceProjectId, sourceFileId, workspaceId } = req.body;

    if (!title || !code || !language) {
      return res.status(400).json({ error: 'Title, code, and language are required.' });
    }
    if (workspaceId) {
      if (!isValidObjectIdString(workspaceId)) return invalidIdResponse(res, 'workspaceId');
      return unsupportedWorkspaceScopeResponse(res);
    }

    if (sourceProjectId && !isValidObjectIdString(sourceProjectId)) {
      return invalidIdResponse(res, 'sourceProjectId');
    }
    if (sourceFileId && !isValidObjectIdString(sourceFileId)) {
      return invalidIdResponse(res, 'sourceFileId');
    }

    let projectOwnerId = req.user.id;
    if (sourceProjectId) {
      const project = await findAccessibleProject(req.user.id, sourceProjectId, '_id userId');
      if (!project) {
        return res.status(404).json({ error: 'Project not found.', code: 'PROJECT_NOT_FOUND' });
      }
      projectOwnerId = (project as any).userId?.toString() || req.user.id;
    }

    if (sourceFileId) {
      const fileFilter: any = { _id: sourceFileId, userId: projectOwnerId };
      if (sourceProjectId) fileFilter.projectId = sourceProjectId;
      const file = await DBFile.findOne(fileFilter, '_id').lean();
      if (!file) {
        return res.status(404).json({ error: 'File not found.', code: 'FILE_NOT_FOUND' });
      }
    }

    const snippet = await Snippet.create({
      userId: req.user.id,
      title: String(title).slice(0, 200),
      code: String(code).slice(0, 50000),
      language: String(language).slice(0, 60),
      explanation: explanation ? String(explanation).slice(0, 2000) : '',
      tags: Array.isArray(tags) ? tags.slice(0, 20).map((tag) => String(tag).slice(0, 40)) : [],
      sourceProjectId,
      sourceFileId,
    });

    // Generate and save embedding for semantic search indexing
    try {
      const vector = await aiService.generateEmbedding(buildSnippetEmbeddingText(title, language, code, explanation));
      await Embedding.create({
        userId: req.user.id,
        projectId: sourceProjectId,
        sourceType: 'snippet',
        sourceId: snippet._id,
        content: `${title}\n${code.slice(0, 1000)}`,
        vector,
        metadata: { title, language },
      });
    } catch (err: any) {
      console.warn(`[SnippetController]: Embedding indexing failed safely. Reason: ${err?.message || 'unknown'}`);
    }

    // Log snippet creation activity
    void Activity.create({
      userId: req.user.id,
      action: `Saved snippet: ${title}`,
      entityType: 'snippet',
      entityId: snippet._id,
      metadata: { snippetTitle: title }
    }).catch(err => console.warn('[SnippetController]: Failed to log snippet activity:', err));

    return res.status(201).json({ message: 'Snippet saved successfully.', snippet });
  } catch {
    return serverErrorResponse(res, 'SNIPPET_CREATE_FAILED');
  }
};

export const getSnippets = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { projectId, language, tag, workspaceId } = req.query;
    const filter: any = { userId: req.user.id };

    if (workspaceId) {
      if (!isValidObjectIdString(workspaceId)) return invalidIdResponse(res, 'workspaceId');
      return unsupportedWorkspaceScopeResponse(res);
    }
    if (projectId) {
      if (!isValidObjectIdString(projectId)) return invalidIdResponse(res, 'projectId');
      const project = await findAccessibleProject(req.user.id, projectId, '_id');
      if (!project) {
        return res.status(404).json({ error: 'Project not found.', code: 'PROJECT_NOT_FOUND' });
      }
      filter.sourceProjectId = projectId;
    }
    if (typeof language === 'string' && language.trim()) filter.language = language.trim();
    if (typeof tag === 'string' && tag.trim()) filter.tags = tag.trim();

    const snippets = await Snippet.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ snippets });
  } catch {
    return serverErrorResponse(res, 'SNIPPET_LIST_FAILED');
  }
};

export const getSnippetById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    if (!isValidObjectIdString(req.params.id)) return invalidIdResponse(res, 'snippetId');

    const snippet = await Snippet.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!snippet) return res.status(404).json({ error: 'Snippet not found.', code: 'SNIPPET_NOT_FOUND' });
    return res.status(200).json({ snippet });
  } catch {
    return serverErrorResponse(res, 'SNIPPET_READ_FAILED');
  }
};

export const deleteSnippet = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    if (!isValidObjectIdString(req.params.id)) return invalidIdResponse(res, 'snippetId');

    const snippet = await Snippet.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    
    if (!snippet) return res.status(404).json({ error: 'Snippet not found.', code: 'SNIPPET_NOT_FOUND' });

    // Clean up associated vector embedding
    await Embedding.deleteMany({ sourceId: req.params.id, sourceType: 'snippet' });

    return res.status(200).json({ message: 'Snippet deleted successfully.' });
  } catch {
    return serverErrorResponse(res, 'SNIPPET_DELETE_FAILED');
  }
};
