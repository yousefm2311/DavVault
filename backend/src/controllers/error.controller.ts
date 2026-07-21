import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { ErrorSolution, Embedding, Activity } from '../models';
import { aiService } from '../services/ai.service';
import { findAccessibleProject, isValidObjectIdString } from '../utils/access-control';

const invalidIdResponse = (res: Response, field: string) => res.status(400).json({
  error: `Invalid ${field}.`,
  code: 'INVALID_OBJECT_ID',
});

const serverErrorResponse = (res: Response, code: string) => res.status(500).json({
  error: 'An unexpected error-library API error occurred.',
  code,
});

const buildErrorEmbeddingText = (
  title: string,
  errorMessage: string,
  cause: string,
  solution: string
) => `${title}\n${errorMessage.slice(0, 5000)}\n${cause.slice(0, 3000)}\n${solution.slice(0, 5000)}`;

const unsupportedWorkspaceScopeResponse = (res: Response) => res.status(400).json({
  error: 'Error library records are user-private/project-referenced and do not support workspace filtering.',
  code: 'WORKSPACE_SCOPE_UNSUPPORTED',
});

export const createErrorSolution = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { title, errorMessage, cause, solution, beforeCode, afterCode, projectId, tags, workspaceId } = req.body;

    if (!title || !errorMessage || !cause || !solution) {
      return res.status(400).json({ error: 'Title, errorMessage, cause, and solution are required.' });
    }
    if (workspaceId) {
      if (!isValidObjectIdString(workspaceId)) return invalidIdResponse(res, 'workspaceId');
      return unsupportedWorkspaceScopeResponse(res);
    }
    if (projectId) {
      if (!isValidObjectIdString(projectId)) return invalidIdResponse(res, 'projectId');
      const project = await findAccessibleProject(req.user.id, projectId, '_id');
      if (!project) return res.status(404).json({ error: 'Project not found.', code: 'PROJECT_NOT_FOUND' });
    }

    const errorSolution = await ErrorSolution.create({
      userId: req.user.id,
      title: String(title).slice(0, 200),
      errorMessage: String(errorMessage).slice(0, 8000),
      cause: String(cause).slice(0, 4000),
      solution: String(solution).slice(0, 8000),
      beforeCode: beforeCode ? String(beforeCode).slice(0, 12000) : '',
      afterCode: afterCode ? String(afterCode).slice(0, 12000) : '',
      projectId,
      tags: Array.isArray(tags) ? tags.slice(0, 20).map((tag) => String(tag).slice(0, 40)) : [],
    });

    // Generate vector embedding for semantic search
    try {
      const vector = await aiService.generateEmbedding(buildErrorEmbeddingText(title, errorMessage, cause, solution));
      await Embedding.create({
        userId: req.user.id,
        projectId,
        sourceType: 'errorSolution',
        sourceId: errorSolution._id,
        content: `${title}\nError: ${errorMessage.slice(0, 1000)}\nSolution: ${solution.slice(0, 1000)}`,
        vector,
        metadata: { title },
      });
    } catch (err: any) {
      console.warn(`[ErrorController]: Embedding indexing failed safely. Reason: ${err?.message || 'unknown'}`);
    }

    // Log bug resolution activity
    void Activity.create({
      userId: req.user.id,
      action: `Logged bug resolution: ${title}`,
      entityType: 'error',
      entityId: errorSolution._id,
      metadata: { errorTitle: title }
    }).catch(err => console.warn('[ErrorController]: Failed to log error activity:', err));

    return res.status(201).json({ message: 'Error solution logged successfully.', errorSolution });
  } catch {
    return serverErrorResponse(res, 'ERROR_LIBRARY_CREATE_FAILED');
  }
};

export const getErrors = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { projectId, tag, workspaceId } = req.query;
    const filter: any = { userId: req.user.id };

    if (workspaceId) {
      if (!isValidObjectIdString(workspaceId)) return invalidIdResponse(res, 'workspaceId');
      return unsupportedWorkspaceScopeResponse(res);
    }
    if (projectId) {
      if (!isValidObjectIdString(projectId)) return invalidIdResponse(res, 'projectId');
      const project = await findAccessibleProject(req.user.id, projectId, '_id');
      if (!project) return res.status(404).json({ error: 'Project not found.', code: 'PROJECT_NOT_FOUND' });
      filter.projectId = projectId;
    }
    if (typeof tag === 'string' && tag.trim()) filter.tags = tag.trim();

    const errors = await ErrorSolution.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ errors });
  } catch {
    return serverErrorResponse(res, 'ERROR_LIBRARY_LIST_FAILED');
  }
};

export const getErrorById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    if (!isValidObjectIdString(req.params.id)) return invalidIdResponse(res, 'errorId');

    const error = await ErrorSolution.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!error) return res.status(404).json({ error: 'Error solution record not found.', code: 'ERROR_LESSON_NOT_FOUND' });
    return res.status(200).json({ error });
  } catch {
    return serverErrorResponse(res, 'ERROR_LIBRARY_READ_FAILED');
  }
};

export const deleteError = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    if (!isValidObjectIdString(req.params.id)) return invalidIdResponse(res, 'errorId');

    const error = await ErrorSolution.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    
    if (!error) return res.status(404).json({ error: 'Error solution record not found.', code: 'ERROR_LESSON_NOT_FOUND' });

    // Clean up associated vector embedding
    await Embedding.deleteMany({ sourceId: req.params.id, sourceType: 'errorSolution' });

    return res.status(200).json({ message: 'Error solution record deleted successfully.' });
  } catch {
    return serverErrorResponse(res, 'ERROR_LIBRARY_DELETE_FAILED');
  }
};
