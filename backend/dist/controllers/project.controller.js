"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectGraph = exports.getProjectHealth = exports.getFileContent = exports.getProjectFiles = exports.getProjectOverview = exports.deleteProject = exports.getProjectById = exports.getProjects = exports.uploadProject = void 0;
const fs_1 = __importDefault(require("fs"));
const models_1 = require("../models");
const queue_service_1 = require("../services/queue.service");
const storage_service_1 = require("../services/storage.service");
const uploadProject = async (req, res) => {
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
            fs_1.default.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Project name is required.' });
        }
        // Get user default workspace
        let workspace = await models_1.Workspace.findOne({ ownerId: req.user.id });
        if (!workspace) {
            workspace = await models_1.Workspace.create({
                name: `${req.user.email.split('@')[0]}'s Brain`,
                ownerId: req.user.id,
                members: [{ userId: req.user.id, role: 'owner' }],
            });
        }
        // Create project in DB
        const newProject = await models_1.Project.create({
            userId: req.user.id,
            workspaceId: workspace._id,
            name,
            description: req.body.description || '',
            healthScore: 100,
        });
        // Schedule background processing
        await queue_service_1.queueService.addJob(newProject._id.toString(), req.user.id, req.file.path);
        return res.status(202).json({
            message: 'Project ZIP uploaded successfully. Indexing started in background.',
            projectId: newProject._id,
            name: newProject.name,
            status: 'indexing',
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.uploadProject = uploadProject;
const getProjects = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const projects = await models_1.Project.find({ userId: req.user.id }).sort({ createdAt: -1 });
        return res.status(200).json({ projects });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getProjects = getProjects;
const getProjectById = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const { id } = req.params;
        const project = await models_1.Project.findOne({ _id: id, userId: req.user.id });
        if (!project) {
            return res.status(404).json({ error: 'Project not found.' });
        }
        return res.status(200).json({ project });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getProjectById = getProjectById;
const deleteProject = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const { id } = req.params;
        const project = await models_1.Project.findOneAndDelete({ _id: id, userId: req.user.id });
        if (!project) {
            return res.status(404).json({ error: 'Project not found.' });
        }
        // Clean up related documents
        await models_1.File.deleteMany({ projectId: id });
        await models_1.CodeEntity.deleteMany({ projectId: id });
        await models_1.Embedding.deleteMany({ projectId: id });
        await models_1.Activity.deleteMany({ entityId: id, entityType: 'project' });
        // Clean up local storage
        await storage_service_1.storageService.deleteProjectFiles(id);
        return res.status(200).json({ message: 'Project and all index records deleted successfully.' });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.deleteProject = deleteProject;
const getProjectOverview = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const { id } = req.params;
        const project = await models_1.Project.findOne({ _id: id, userId: req.user.id });
        if (!project)
            return res.status(404).json({ error: 'Project not found.' });
        const totalFiles = await models_1.File.countDocuments({ projectId: id });
        const totalEntities = await models_1.CodeEntity.countDocuments({ projectId: id });
        const files = await models_1.File.find({ projectId: id }, 'fileName extension size');
        const totalSize = files.reduce((acc, f) => acc + f.size, 0);
        return res.status(200).json({
            project,
            stats: {
                totalFiles,
                totalEntities,
                totalSize,
            },
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getProjectOverview = getProjectOverview;
const getProjectFiles = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const { id } = req.params;
        const files = await models_1.File.find({ projectId: id, userId: req.user.id }, 'path fileName extension size summary language');
        return res.status(200).json({ files });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getProjectFiles = getProjectFiles;
const getFileContent = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const { projectId, fileId } = req.params;
        const file = await models_1.File.findOne({ _id: fileId, projectId, userId: req.user.id });
        if (!file)
            return res.status(404).json({ error: 'File not found.' });
        return res.status(200).json({
            id: file._id,
            path: file.path,
            fileName: file.fileName,
            language: file.language,
            content: file.content,
            summary: file.summary,
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getFileContent = getFileContent;
const getProjectHealth = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const { id } = req.params;
        const project = await models_1.Project.findOne({ _id: id, userId: req.user.id });
        if (!project)
            return res.status(404).json({ error: 'Project not found.' });
        // Analyze file contents to identify actual code quality and structure issues
        const files = await models_1.File.find({ projectId: id });
        const problems = [];
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getProjectHealth = getProjectHealth;
const getProjectGraph = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized.' });
        const { id } = req.params;
        // Get files and code entities to make nodes/edges
        const files = await models_1.File.find({ projectId: id }, 'fileName path language');
        const entities = await models_1.CodeEntity.find({ projectId: id }, 'name type fileId dependencies');
        // Make nodes
        const nodes = files.map((f, i) => ({
            id: f._id.toString(),
            type: 'fileNode',
            data: { label: f.fileName, path: f.path, language: f.language },
            position: { x: 100 + (i % 4) * 250, y: 100 + Math.floor(i / 4) * 200 },
        }));
        // Add entities as subnodes or connect them
        const edges = [];
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getProjectGraph = getProjectGraph;
