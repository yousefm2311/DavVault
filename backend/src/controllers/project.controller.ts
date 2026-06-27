import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth';
import { Project, Workspace, File as DBFile, CodeEntity, Embedding, Activity, Subscription } from '../models';
import { queueService } from '../services/queue.service';
import { storageService } from '../services/storage.service';

const accessibleProjectFilter = async (userId: string, projectId?: string) => {
  const workspaces = await Workspace.find({ 'members.userId': userId }, '_id').lean();
  return {
    ...(projectId ? { _id: projectId } : {}),
    $or: [
      { userId },
      { workspaceId: { $in: workspaces.map((workspace) => workspace._id) } },
    ],
  };
};

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

    const zip = new AdmZip(req.file.path);
    const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
    const maxEntries = 5000;
    const maxExpandedBytes = 200 * 1024 * 1024;
    const maxFileBytes = 10 * 1024 * 1024;
    const expandedBytes = entries.reduce((sum, entry) => sum + Number(entry.header.size || 0), 0);
    const compressedBytes = Math.max(1, req.file.size);
    const expansionRatio = expandedBytes / compressedBytes;

    if (
      entries.length > maxEntries ||
      expandedBytes > maxExpandedBytes ||
      expansionRatio > 100 ||
      entries.some((entry) => Number(entry.header.size || 0) > maxFileBytes)
    ) {
      await fs.promises.rm(req.file.path, { force: true });
      return res.status(413).json({
        error: 'ZIP archive exceeds safe extraction limits.',
        code: 'UNSAFE_ZIP_ARCHIVE',
      });
    }

    const [subscription, storageUsage] = await Promise.all([
      Subscription.findOne({ userId: req.user.id }),
      DBFile.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
        { $group: { _id: null, total: { $sum: '$size' } } },
      ]),
    ]);
    const storageLimit = subscription?.limits.storageBytes || 100 * 1024 * 1024;
    const currentStorage = storageUsage[0]?.total || 0;
    if (currentStorage + expandedBytes > storageLimit) {
      await fs.promises.rm(req.file.path, { force: true });
      return res.status(403).json({
        error: 'This upload exceeds your plan storage limit.',
        code: 'STORAGE_LIMIT_EXCEEDED',
      });
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
      processingStatus: 'pending',
      processingProgress: 0,
      processingMessage: 'Queued for indexing',
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

    const projects = await Project.find(await accessibleProjectFilter(req.user.id)).sort({ createdAt: -1 });
    return res.status(200).json({ projects });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getProjectById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { id } = req.params;

    const project = await Project.findOne(await accessibleProjectFilter(req.user.id, id));
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

    const project = await Project.findOne(await accessibleProjectFilter(req.user.id, id));
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

    const project = await Project.findOne(await accessibleProjectFilter(req.user.id, id), '_id');
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    const files = await DBFile.find({ projectId: id }, 'path fileName extension size summary language');
    return res.status(200).json({ files });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getFileContent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { projectId, fileId } = req.params;

    const project = await Project.findOne(await accessibleProjectFilter(req.user.id, projectId), '_id');
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    const file = await DBFile.findOne({ _id: fileId, projectId });
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

    const project = await Project.findOne(await accessibleProjectFilter(req.user.id, id));
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
    project.healthScore = healthScore;
    await project.save();

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

    const project = await Project.findOne(await accessibleProjectFilter(req.user.id, id));
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    // Get files and code entities to make nodes/edges
    const files = await DBFile.find({ projectId: id }, 'fileName path language extension size summary content');
    const entities = await CodeEntity.find({ projectId: id }, 'name type fileId dependencies');

    // Make nodes
    const nodes = files.map((f, i) => ({
      id: f._id.toString(),
      type: 'fileNode',
      data: {
        label: f.fileName,
        path: f.path,
        language: f.language,
        extension: f.extension,
        size: f.size,
        summary: f.summary,
      },
      position: { x: 100 + (i % 4) * 250, y: 100 + Math.floor(i / 4) * 200 },
    }));

    // Add entities as subnodes or connect them
    const edges: { id: string; source: string; target: string; animated?: boolean; label?: string }[] = [];
    const edgeKeys = new Set<string>();

    const addEdge = (source: string, target: string, label?: string) => {
      if (source === target) return;
      const key = `${source}->${target}`;
      if (edgeKeys.has(key)) return;
      edgeKeys.add(key);
      edges.push({
        id: `edge_${source}_to_${target}`,
        source,
        target,
        animated: true,
        ...(label ? { label } : {}),
      });
    };

    // Helper to resolve relative paths in POSIX-style (forward slashes)
    const resolveRelativePath = (sourcePath: string, relativePath: string) => {
      const sourceDirParts = sourcePath.split('/');
      sourceDirParts.pop(); // Remove source file name to get its directory
      
      const relParts = relativePath.split('/');
      for (const part of relParts) {
        if (part === '.') {
          continue;
        } else if (part === '..') {
          sourceDirParts.pop();
        } else if (part) {
          sourceDirParts.push(part);
        }
      }
      return sourceDirParts.join('/');
    };

    // Robust resolver matching exact, extension-appended, or index file paths
    const resolveImport = (sourcePath: string, importPath: string) => {
      const candidates: string[] = [];
      
      if (importPath.startsWith('.') || importPath.startsWith('@/')) {
        if (importPath.startsWith('@/')) {
          const rel = importPath.slice(2);
          candidates.push(`src/${rel}`, rel);
        } else {
          candidates.push(resolveRelativePath(sourcePath, importPath));
        }
        
        for (const targetFullPath of candidates) {
          const found = files.find(file => {
            const fp = file.path.replace(/\\/g, '/');
            if (fp === targetFullPath) return true;
            if (fp.startsWith(targetFullPath + '.')) return true;
            if (fp === `${targetFullPath}/index.ts` || 
                fp === `${targetFullPath}/index.tsx` || 
                fp === `${targetFullPath}/index.js` ||
                fp === `${targetFullPath}/index.jsx`) {
              return true;
            }
            return false;
          });
          if (found) return found;
        }
      }
      
      // Fallback fuzzy search: match filename
      const importFilename = importPath.split('/').pop()?.toLowerCase();
      if (importFilename) {
        const cleanFilename = importFilename.replace(/\.[^.]+$/, '');
        const found = files.find(file => {
          const fileBase = file.fileName.replace(/\.[^.]+$/, '').toLowerCase();
          return fileBase === cleanFilename;
        });
        if (found) return found;
      }
      
      return null;
    };

    // Find imports or dependencies
    entities.forEach(entity => {
      entity.dependencies.forEach(depName => {
        // Match dependency string with filenames
        const matchedFile = files.find(f => f.fileName.toLowerCase().includes(depName.toLowerCase()) || depName.toLowerCase().includes(f.fileName.toLowerCase()));
        if (matchedFile && matchedFile._id.toString() !== entity.fileId.toString()) {
          addEdge(entity.fileId.toString(), matchedFile._id.toString(), entity.type);
        }
      });
    });

    const jsImportRegex = /(?:import\s+(?:[^'"]+\s+from\s+)?|export\s+[^'"]+\s+from\s+|require\()\s*['"]([^'"]+)['"]/g;
    const pyImportRegex = /(?:^|\n)\s*(?:import\s+([a-zA-Z0-9_]+)|from\s+([a-zA-Z0-9_.]+)\s+import)/g;
    const dartImportRegex = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;

    files.forEach(file => {
      const content = file.content || '';
      const lang = file.language || '';

      if (['javascript', 'typescript', 'javascript-react', 'typescript-react'].includes(lang)) {
        let match: RegExpExecArray | null;
        jsImportRegex.lastIndex = 0;
        while ((match = jsImportRegex.exec(content)) !== null) {
          const importPath = match[1];
          const target = resolveImport(file.path, importPath);
          if (target) {
            addEdge(file._id.toString(), target._id.toString(), 'import');
          }
        }
      } else if (lang === 'python') {
        let match: RegExpExecArray | null;
        pyImportRegex.lastIndex = 0;
        while ((match = pyImportRegex.exec(content)) !== null) {
          const importPath = (match[1] || match[2] || '').replace(/\./g, '/');
          if (importPath) {
            const target = resolveImport(file.path, importPath);
            if (target) {
              addEdge(file._id.toString(), target._id.toString(), 'import');
            }
          }
        }
      } else if (lang === 'dart') {
        let match: RegExpExecArray | null;
        dartImportRegex.lastIndex = 0;
        while ((match = dartImportRegex.exec(content)) !== null) {
          const importPath = match[1];
          if (importPath.startsWith('package:') || importPath.startsWith('dart:')) continue;
          const target = resolveImport(file.path, importPath);
          if (target) {
            addEdge(file._id.toString(), target._id.toString(), 'import');
          }
        }
      }
    });

    return res.status(200).json({ nodes, edges });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const downloadProjectZip = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { id } = req.params;

    const project = await Project.findOne(await accessibleProjectFilter(req.user.id, id));
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const files = await DBFile.find({ projectId: id });
    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'No files found for this project.' });
    }

    const zip = new AdmZip();

    for (const file of files) {
      const buffer = Buffer.from(file.content || '', 'utf8');
      zip.addFile(file.path, buffer);
    }

    const zipBuffer = zip.toBuffer();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(project.name)}.zip"`);
    res.setHeader('Content-Length', zipBuffer.length);
    
    return res.end(zipBuffer);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
