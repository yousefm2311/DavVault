import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { AuthenticatedRequest } from '../middleware/auth';
import { Project, Workspace, File as DBFile, CodeEntity, Embedding, Activity } from '../models';
import { queueService } from '../services/queue.service';
import { storageService } from '../services/storage.service';

export const uploadProject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a ZIP file.' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { name } = req.body;
    if (!name) {
      // Cleanup file if name is missing
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Project name is required.' });
    }

    // Get user default workspace
    let workspace = await Workspace.findOne({ ownerId: req.user.id });
    if (!workspace) {
      workspace = await Workspace.create({
        name: `${req.user.email.split('@')[0]}'s Brain`,
        ownerId: req.user.id,
        members: [{ userId: req.user.id, role: 'owner' }],
      });
    }

    // Create project in DB
    const newProject = await Project.create({
      userId: req.user.id,
      workspaceId: workspace._id,
      name,
      description: req.body.description || '',
      healthScore: 100,
    });

    // Schedule background processing
    await queueService.addJob(
      newProject._id.toString(),
      req.user.id,
      req.file.path
    );

    return res.status(202).json({
      message: 'Project ZIP uploaded successfully. Indexing started in background.',
      projectId: newProject._id,
      name: newProject.name,
      status: 'indexing',
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getProjects = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    const projects = await Project.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ projects });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getProjectById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { id } = req.params;

    const project = await Project.findOne({ _id: id, userId: req.user.id });
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    return res.status(200).json({ project });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const deleteProject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { id } = req.params;

    const project = await Project.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Clean up related documents
    await DBFile.deleteMany({ projectId: id });
    await CodeEntity.deleteMany({ projectId: id });
    await Embedding.deleteMany({ projectId: id });
    await Activity.deleteMany({ entityId: id, entityType: 'project' });

    // Clean up local storage
    await storageService.deleteProjectFiles(id);

    return res.status(200).json({ message: 'Project and all index records deleted successfully.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getProjectOverview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { id } = req.params;

    const project = await Project.findOne({ _id: id, userId: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const totalFiles = await DBFile.countDocuments({ projectId: id });
    const totalEntities = await CodeEntity.countDocuments({ projectId: id });
    const files = await DBFile.find({ projectId: id }, 'fileName extension size');
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);

    return res.status(200).json({
      project,
      stats: {
        totalFiles,
        totalEntities,
        totalSize,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getProjectFiles = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { id } = req.params;

    const files = await DBFile.find({ projectId: id, userId: req.user.id }, 'path fileName extension size summary language');
    return res.status(200).json({ files });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getFileContent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { projectId, fileId } = req.params;

    const file = await DBFile.findOne({ _id: fileId, projectId, userId: req.user.id });
    if (!file) return res.status(404).json({ error: 'File not found.' });

    return res.status(200).json({
      id: file._id,
      path: file.path,
      fileName: file.fileName,
      language: file.language,
      content: file.content,
      summary: file.summary,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getProjectHealth = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { id } = req.params;

    const project = await Project.findOne({ _id: id, userId: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    // Analyze file contents to identify actual code quality and structure issues
    const files = await DBFile.find({ projectId: id });
    const problems: { file: string; type: string; severity: 'high' | 'medium' | 'low'; description: string }[] = [];

    let emptyCatchCount = 0;
    let largeFileCount = 0;

    for (const file of files) {
      if (file.content.includes('catch (e) {}') || file.content.includes('catch (error) {}')) {
        emptyCatchCount++;
        problems.push({
          file: file.path,
          type: 'Empty catch block',
          severity: 'medium',
          description: 'Empty catch block silences errors. Implement logger or alert handler.',
        });
      }
      if (file.size > 20000) {
        largeFileCount++;
        problems.push({
          file: file.path,
          type: 'Extremely large file',
          severity: 'low',
          description: `File size is ${(file.size / 1024).toFixed(1)}KB. Consider splitting code into smaller modules.`,
        });
      }
      if (file.content.includes('TODO:') || file.content.includes('TODO')) {
        problems.push({
          file: file.path,
          type: 'Unresolved TODO comment',
          severity: 'low',
          description: 'Technical debt remaining. Address TODO notes.',
        });
      }
    }

    const healthScore = Math.max(60, 100 - emptyCatchCount * 8 - largeFileCount * 4);

    return res.status(200).json({
      healthScore,
      problems,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getProjectGraph = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { id } = req.params;

    // Get files and code entities to make nodes/edges
    const files = await DBFile.find({ projectId: id }, 'fileName path language');
    const entities = await CodeEntity.find({ projectId: id }, 'name type fileId dependencies');

    // Make nodes
    const nodes = files.map((f, i) => ({
      id: f._id.toString(),
      type: 'fileNode',
      data: { label: f.fileName, path: f.path, language: f.language },
      position: { x: 100 + (i % 4) * 250, y: 100 + Math.floor(i / 4) * 200 },
    }));

    // Add entities as subnodes or connect them
    const edges: { id: string; source: string; target: string; animated?: boolean }[] = [];

    // Find imports or dependencies
    entities.forEach(entity => {
      entity.dependencies.forEach(depName => {
        // Match dependency string with filenames
        const matchedFile = files.find(f => f.fileName.toLowerCase().includes(depName.toLowerCase()) || depName.toLowerCase().includes(f.fileName.toLowerCase()));
        if (matchedFile && matchedFile._id.toString() !== entity.fileId.toString()) {
          edges.push({
            id: `edge_${entity._id}_to_${matchedFile._id}`,
            source: entity.fileId.toString(),
            target: matchedFile._id.toString(),
            animated: true,
          });
        }
      });
    });

    return res.status(200).json({ nodes, edges });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
