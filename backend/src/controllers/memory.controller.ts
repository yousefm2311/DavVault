import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { Memory } from '../models/Memory';
import { Workspace } from '../models/Workspace';
import { memoryService } from '../services/memory.service';
import { Types } from 'mongoose';
import { findAccessibleProject, isValidObjectIdString } from '../utils/access-control';
import { MemoryScope, MemorySource, MemoryType } from '../models/Memory';

const invalidIdResponse = (res: Response, field: string) => res.status(400).json({
  error: `Invalid ${field}.`,
  code: 'INVALID_OBJECT_ID',
});

const serverErrorResponse = (res: Response, code: string) => res.status(500).json({
  error: 'An unexpected memory API error occurred.',
  code,
});

const canAccessWorkspace = async (userId: string, workspaceId: string) => {
  if (!isValidObjectIdString(workspaceId)) return false;
  return Boolean(await Workspace.exists({
    _id: workspaceId,
    $or: [
      { ownerId: userId },
      { 'members.userId': userId },
    ],
  }));
};

const MEMORY_TYPES: MemoryType[] = [
  'preference',
  'coding_style',
  'architecture_rule',
  'debugging_pattern',
  'tooling_preference',
  'workspace_rule',
  'correction',
  'decision',
];

const MEMORY_SCOPES: MemoryScope[] = ['user', 'project', 'workspace'];
const MEMORY_SOURCES: MemorySource[] = ['chat', 'manual', 'system', 'developer_dna', 'debugging_lesson'];

const isMemoryType = (value: unknown): value is MemoryType => (
  typeof value === 'string' && MEMORY_TYPES.includes(value as MemoryType)
);

const isMemoryScope = (value: unknown): value is MemoryScope => (
  typeof value === 'string' && MEMORY_SCOPES.includes(value as MemoryScope)
);

const isMemorySource = (value: unknown): value is MemorySource => (
  typeof value === 'string' && MEMORY_SOURCES.includes(value as MemorySource)
);

const normalizeConfidence = (value: unknown) => {
  if (value === undefined || value === null || value === '') return 0.7;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0.7;
};

const buildReadableMemoryFilter = async (userId: string, options: {
  projectId?: string;
  workspaceId?: string;
  scope?: MemoryScope;
}) => {
  const scopeConditions: any[] = [{ userId: new Types.ObjectId(userId), scope: 'user' }];

  if (options.projectId) {
    scopeConditions.push({ projectId: new Types.ObjectId(options.projectId), scope: 'project' });
  }
  if (options.workspaceId) {
    scopeConditions.push({ workspaceId: new Types.ObjectId(options.workspaceId), scope: 'workspace' });
  }

  const filter: any = {
    isActive: true,
    $or: scopeConditions,
  };
  if (options.scope) filter.scope = options.scope;
  return filter;
};

/**
 * GET /api/memory
 * Returns active memories owned by the authenticated user.
 * Optional query params: scope, type, projectId, workspaceId, limit.
 */
export const getMemories = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    const { scope, type, projectId, workspaceId } = req.query;
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);

    if (scope && !isMemoryScope(scope)) {
      return res.status(400).json({ error: 'Invalid memory scope.', code: 'INVALID_MEMORY_SCOPE' });
    }
    if (type && !isMemoryType(type)) {
      return res.status(400).json({ error: 'Invalid memory type.', code: 'INVALID_MEMORY_TYPE' });
    }

    let scopedProjectId: string | undefined;
    let scopedWorkspaceId: string | undefined;
    if (projectId) {
      if (!isValidObjectIdString(projectId)) return invalidIdResponse(res, 'projectId');
      const project = await findAccessibleProject(req.user.id, projectId, '_id');
      if (!project) return res.status(404).json({ error: 'Project not found.', code: 'PROJECT_NOT_FOUND' });
      scopedProjectId = projectId as string;
    }
    if (workspaceId) {
      if (!isValidObjectIdString(workspaceId)) return invalidIdResponse(res, 'workspaceId');
      const hasWorkspaceAccess = await canAccessWorkspace(req.user.id, workspaceId as string);
      if (!hasWorkspaceAccess) return res.status(404).json({ error: 'Workspace not found.', code: 'WORKSPACE_NOT_FOUND' });
      scopedWorkspaceId = workspaceId as string;
    }

    const filter = await buildReadableMemoryFilter(req.user.id, {
      projectId: scopedProjectId,
      workspaceId: scopedWorkspaceId,
      scope: scope as MemoryScope | undefined,
    });
    if (type) filter.type = type;

    const memories = await Memory.find(filter)
      .sort({ usageCount: -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({ memories });
  } catch {
    return serverErrorResponse(res, 'MEMORY_LIST_FAILED');
  }
};

/**
 * POST /api/memory
 * Manually creates a new memory entry.
 */
export const createMemory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    const { type, scope, title, content, source, workspaceId, projectId, confidence, tags } = req.body;

    if (!type || !scope || !title || !content || !source) {
      return res.status(400).json({ error: 'type, scope, title, content, and source are required.' });
    }
    if (!isMemoryType(type)) {
      return res.status(400).json({ error: 'Invalid memory type.', code: 'INVALID_MEMORY_TYPE' });
    }
    if (!isMemoryScope(scope)) {
      return res.status(400).json({ error: 'Invalid memory scope.', code: 'INVALID_MEMORY_SCOPE' });
    }
    if (!isMemorySource(source)) {
      return res.status(400).json({ error: 'Invalid memory source.', code: 'INVALID_MEMORY_SOURCE' });
    }
    if (scope === 'project' && !projectId) {
      return res.status(400).json({ error: 'projectId is required for project-scoped memory.', code: 'PROJECT_SCOPE_REQUIRED' });
    }
    if (scope === 'workspace' && !workspaceId) {
      return res.status(400).json({ error: 'workspaceId is required for workspace-scoped memory.', code: 'WORKSPACE_SCOPE_REQUIRED' });
    }
    if (scope === 'user' && (projectId || workspaceId)) {
      return res.status(400).json({ error: 'User-scoped memory cannot include projectId or workspaceId.', code: 'INVALID_MEMORY_SCOPE_TARGET' });
    }
    if (projectId) {
      if (!isValidObjectIdString(projectId)) return invalidIdResponse(res, 'projectId');
      const project = await findAccessibleProject(req.user.id, projectId, '_id');
      if (!project) return res.status(404).json({ error: 'Project not found.', code: 'PROJECT_NOT_FOUND' });
    }
    if (workspaceId) {
      if (!isValidObjectIdString(workspaceId)) return invalidIdResponse(res, 'workspaceId');
      const hasWorkspaceAccess = await canAccessWorkspace(req.user.id, workspaceId);
      if (!hasWorkspaceAccess) return res.status(404).json({ error: 'Workspace not found.', code: 'WORKSPACE_NOT_FOUND' });
    }

    const memory = await memoryService.createMemory({
      userId:      req.user.id,
      workspaceId: workspaceId || undefined,
      projectId:   projectId   || undefined,
      type,
      scope,
      title,
      content,
      source:      source || 'manual',
      confidence:  normalizeConfidence(confidence),
      tags:        Array.isArray(tags) ? tags.slice(0, 20).map((tag) => String(tag).slice(0, 40)) : [],
    });

    if (!memory) {
      return res.status(409).json({ error: 'Memory already exists or was rejected.', code: 'MEMORY_REJECTED' });
    }

    return res.status(201).json({ memory });
  } catch {
    return serverErrorResponse(res, 'MEMORY_CREATE_FAILED');
  }
};

/**
 * GET /api/memory/:id
 * Returns a memory when the authenticated user can read its scope.
 * Updates/deletes remain owner-only.
 */
export const getMemoryById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { id } = req.params;
    if (!isValidObjectIdString(id)) return invalidIdResponse(res, 'memoryId');

    const memory = await Memory.findOne({ _id: id, isActive: true }).lean();
    if (!memory) return res.status(404).json({ error: 'Memory not found.', code: 'MEMORY_NOT_FOUND' });

    if ((memory as any).scope === 'user') {
      if ((memory as any).userId?.toString() !== req.user.id) {
        return res.status(404).json({ error: 'Memory not found.', code: 'MEMORY_NOT_FOUND' });
      }
    } else if ((memory as any).scope === 'project') {
      const projectId = (memory as any).projectId?.toString();
      if (!projectId || !await findAccessibleProject(req.user.id, projectId, '_id')) {
        return res.status(404).json({ error: 'Memory not found.', code: 'MEMORY_NOT_FOUND' });
      }
    } else if ((memory as any).scope === 'workspace') {
      const workspaceId = (memory as any).workspaceId?.toString();
      if (!workspaceId || !await canAccessWorkspace(req.user.id, workspaceId)) {
        return res.status(404).json({ error: 'Memory not found.', code: 'MEMORY_NOT_FOUND' });
      }
    } else {
      return res.status(404).json({ error: 'Memory not found.', code: 'MEMORY_NOT_FOUND' });
    }

    return res.status(200).json({ memory });
  } catch {
    return serverErrorResponse(res, 'MEMORY_READ_FAILED');
  }
};

/**
 * PATCH /api/memory/:id
 * Updates an existing memory (title, content, confidence, tags, isActive).
 * Only the owner can update.
 */
export const updateMemory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    const { id } = req.params;
    if (!isValidObjectIdString(id)) return invalidIdResponse(res, 'memoryId');
    const { title, content, confidence, tags, isActive } = req.body;

    const allowedUpdates: any = {};
    if (title !== undefined)      allowedUpdates.title      = String(title).substring(0, 200);
    if (content !== undefined)    allowedUpdates.content    = String(content).substring(0, 2000);
    if (confidence !== undefined) allowedUpdates.confidence = normalizeConfidence(confidence);
    if (tags !== undefined)       allowedUpdates.tags       = Array.isArray(tags) ? tags.slice(0, 20).map((tag) => String(tag).slice(0, 40)) : [];
    if (isActive !== undefined)   allowedUpdates.isActive   = Boolean(isActive);

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided.' });
    }

    const updated = await Memory.findOneAndUpdate(
      { _id: id, userId: new Types.ObjectId(req.user.id) },
      { $set: allowedUpdates },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: 'Memory not found.', code: 'MEMORY_NOT_FOUND' });
    }

    return res.status(200).json({ memory: updated });
  } catch {
    return serverErrorResponse(res, 'MEMORY_UPDATE_FAILED');
  }
};

/**
 * DELETE /api/memory/:id
 * Soft-deletes a memory (sets isActive = false).
 * Only the owner can delete.
 */
export const deleteMemory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    const { id } = req.params;
    if (!isValidObjectIdString(id)) return invalidIdResponse(res, 'memoryId');

    const memory = await Memory.findOneAndUpdate(
      { _id: id, userId: new Types.ObjectId(req.user.id) },
      { $set: { isActive: false } },
      { new: true }
    ).lean();

    if (!memory) {
      return res.status(404).json({ error: 'Memory not found.', code: 'MEMORY_NOT_FOUND' });
    }

    return res.status(200).json({ message: 'Memory deactivated successfully.' });
  } catch {
    return serverErrorResponse(res, 'MEMORY_DELETE_FAILED');
  }
};
