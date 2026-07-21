import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { ReusableSystem } from '../models';
import { findAccessibleProject, isValidObjectIdString } from '../utils/access-control';

const invalidIdResponse = (res: Response, field: string) => res.status(400).json({
  error: `Invalid ${field}.`,
  code: 'INVALID_OBJECT_ID',
});

const serverErrorResponse = (res: Response, code: string) => res.status(500).json({
  error: 'An unexpected reusable-system API error occurred.',
  code,
});

const unsupportedWorkspaceScopeResponse = (res: Response) => res.status(400).json({
  error: 'Reusable systems are user-owned templates and do not support workspace filtering.',
  code: 'WORKSPACE_SCOPE_UNSUPPORTED',
});

export const createSystem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { name, description, type, relatedFiles, setupSteps, dependencies, flow, tags, workspaceId } = req.body;

    if (!name || !description || !type) {
      return res.status(400).json({ error: 'Name, description, and type are required.' });
    }
    if (workspaceId) {
      if (!isValidObjectIdString(workspaceId)) return invalidIdResponse(res, 'workspaceId');
      return unsupportedWorkspaceScopeResponse(res);
    }

    const system = await ReusableSystem.create({
      userId: req.user.id,
      name: String(name).slice(0, 200),
      description: String(description).slice(0, 4000),
      type: String(type).slice(0, 80),
      relatedFiles: Array.isArray(relatedFiles) ? relatedFiles.slice(0, 50).map((item) => String(item).slice(0, 240)) : [],
      setupSteps: Array.isArray(setupSteps) ? setupSteps.slice(0, 50).map((item) => String(item).slice(0, 500)) : [],
      dependencies: Array.isArray(dependencies) ? dependencies.slice(0, 50).map((item) => String(item).slice(0, 120)) : [],
      flow: flow ? String(flow).slice(0, 12000) : '',
      tags: Array.isArray(tags) ? tags.slice(0, 20).map((tag) => String(tag).slice(0, 40)) : [],
    });

    return res.status(201).json({ message: 'Reusable System template created successfully.', system });
  } catch {
    return serverErrorResponse(res, 'REUSABLE_SYSTEM_CREATE_FAILED');
  }
};

export const getSystems = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { projectId, type, tag, workspaceId } = req.query;
    const filter: any = { userId: req.user.id };

    if (workspaceId) {
      if (!isValidObjectIdString(workspaceId)) return invalidIdResponse(res, 'workspaceId');
      return unsupportedWorkspaceScopeResponse(res);
    }
    // Reusable systems are global user-owned templates. When projectId is provided,
    // validate access to the project before returning the user's global templates.
    if (projectId) {
      if (!isValidObjectIdString(projectId)) return invalidIdResponse(res, 'projectId');
      const project = await findAccessibleProject(req.user.id, projectId, '_id');
      if (!project) return res.status(404).json({ error: 'Project not found.', code: 'PROJECT_NOT_FOUND' });
    }
    if (typeof type === 'string' && type.trim()) filter.type = type.trim();
    if (typeof tag === 'string' && tag.trim()) filter.tags = tag.trim();

    const systems = await ReusableSystem.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ systems });
  } catch {
    return serverErrorResponse(res, 'REUSABLE_SYSTEM_LIST_FAILED');
  }
};

export const getSystemById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    if (!isValidObjectIdString(req.params.id)) return invalidIdResponse(res, 'systemId');

    const system = await ReusableSystem.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!system) return res.status(404).json({ error: 'Reusable system template not found.', code: 'SYSTEM_NOT_FOUND' });
    return res.status(200).json({ system });
  } catch {
    return serverErrorResponse(res, 'REUSABLE_SYSTEM_READ_FAILED');
  }
};

export const deleteSystem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    if (!isValidObjectIdString(req.params.id)) return invalidIdResponse(res, 'systemId');

    const system = await ReusableSystem.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    
    if (!system) return res.status(404).json({ error: 'Reusable system template not found.', code: 'SYSTEM_NOT_FOUND' });
    return res.status(200).json({ message: 'Reusable system template deleted successfully.' });
  } catch {
    return serverErrorResponse(res, 'REUSABLE_SYSTEM_DELETE_FAILED');
  }
};
