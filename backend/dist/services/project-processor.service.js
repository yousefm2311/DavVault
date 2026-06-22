"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectProcessorService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const models_1 = require("../models");
const storage_service_1 = require("./storage.service");
const parser_service_1 = require("./parser.service");
const ai_service_1 = require("./ai.service");
const notification_service_1 = require("./notification.service");
const security_1 = require("../middleware/security");
class ProjectProcessorService {
    // Safe directories and extensions checks
    ignoredFolders = [
        'node_modules',
        '.git',
        '.github',
        'build',
        'dist',
        '.gradle',
        '.idea',
        '.vscode',
        'ios/Pods',
        'android/.gradle',
        'bin',
        'obj'
    ];
    supportedExtensions = [
        'js', 'jsx', 'ts', 'tsx', 'py', 'dart', 'php', 'java',
        'json', 'md', 'txt', 'yml', 'yaml', 'env'
    ];
    async processProjectZip(projectId, userId, zipFilePath, onProgress) {
        try {
            onProgress({ status: 'extracting', progress: 10, message: 'Extracting zip file safely...' });
            const zip = new adm_zip_1.default(zipFilePath);
            const zipEntries = zip.getEntries();
            // Temporary directory for zip extraction
            const tempExtractDir = path_1.default.join(__dirname, `../../uploads/temp_${projectId}`);
            if (!fs_1.default.existsSync(tempExtractDir)) {
                fs_1.default.mkdirSync(tempExtractDir, { recursive: true });
            }
            const filesToProcess = [];
            for (const entry of zipEntries) {
                if (entry.isDirectory)
                    continue;
                const entryName = entry.entryName;
                // 1. Prevent Zip-Slip (Directory Traversal)
                if (entryName.includes('..') || entryName.startsWith('/') || entryName.startsWith('\\')) {
                    console.warn(`[ProjectProcessor]: Blocked potential Zip-Slip entry: ${entryName}`);
                    continue;
                }
                // 2. Filter out ignored folders
                const pathParts = entryName.split(/[/\\]/);
                const isIgnored = pathParts.some(part => this.ignoredFolders.includes(part));
                if (isIgnored)
                    continue;
                // 3. Filter out unsupported files
                const ext = entryName.split('.').pop()?.toLowerCase() || '';
                if (!this.supportedExtensions.includes(ext))
                    continue;
                // Extract buffer and safely save
                const fileContentBuffer = entry.getData();
                const contentStr = fileContentBuffer.toString('utf8');
                const size = fileContentBuffer.length;
                filesToProcess.push({
                    relativePath: entryName,
                    content: contentStr,
                    extension: ext,
                    size
                });
            }
            onProgress({ status: 'parsing', progress: 30, message: `Analyzing ${filesToProcess.length} codebase files...` });
            const filesMetadata = filesToProcess.map(f => ({
                path: f.relativePath,
                content: f.content
            }));
            // Detect Project Language, Framework and DB
            const projectDetails = parser_service_1.parserService.detectFrameworkAndDB(filesMetadata);
            await models_1.Project.findByIdAndUpdate(projectId, {
                language: projectDetails.language,
                framework: projectDetails.framework,
                database: projectDetails.database,
                healthScore: 100 // default initial score
            });
            // Save files to MongoDB and store in Local Storage
            const dbFileIds = [];
            let currentFileIndex = 0;
            for (const file of filesToProcess) {
                currentFileIndex++;
                const filePercent = 30 + Math.floor((currentFileIndex / filesToProcess.length) * 30);
                onProgress({
                    status: 'parsing',
                    progress: filePercent,
                    message: `Parsing [${currentFileIndex}/${filesToProcess.length}] ${path_1.default.basename(file.relativePath)}...`
                });
                // Scan for potential secrets
                const secretScan = (0, security_1.scanForSecrets)(file.content);
                // Save file content to storage
                const storagePath = await storage_service_1.storageService.saveFile(projectId, file.relativePath, secretScan.redacted);
                // Generate file summary (limit summary size for faster runs)
                const summary = await ai_service_1.aiService.generateSummary(path_1.default.basename(file.relativePath), secretScan.redacted.substring(0, 5000), file.extension);
                // Create file document
                const fileDoc = await models_1.File.create({
                    projectId,
                    userId,
                    path: file.relativePath,
                    fileName: path_1.default.basename(file.relativePath),
                    extension: file.extension,
                    size: file.size,
                    content: secretScan.redacted,
                    summary,
                    language: parser_service_1.parserService.detectLanguage(file.relativePath)
                });
                dbFileIds.push(fileDoc._id.toString());
                // Extract entities (Classes, Functions, Routes)
                const entities = parser_service_1.parserService.extractEntities(secretScan.redacted, fileDoc.language || 'text');
                for (const entity of entities) {
                    const entitySummary = `Entity: ${entity.name} (${entity.type}) in ${fileDoc.fileName}.`;
                    const codeEntityDoc = await models_1.CodeEntity.create({
                        projectId,
                        fileId: fileDoc._id,
                        type: entity.type,
                        name: entity.name,
                        code: entity.code,
                        startLine: entity.startLine,
                        endLine: entity.endLine,
                        summary: entitySummary,
                        dependencies: entity.dependencies
                    });
                    // Generate embedding for CodeEntity
                    const entityEmbeddingVector = await ai_service_1.aiService.generateEmbedding(entity.code);
                    await models_1.Embedding.create({
                        userId,
                        projectId,
                        sourceType: 'codeEntity',
                        sourceId: codeEntityDoc._id,
                        content: `${entity.type} ${entity.name}\n${entity.code}`,
                        vector: entityEmbeddingVector,
                        metadata: {
                            name: entity.name,
                            type: entity.type,
                            path: file.relativePath
                        }
                    });
                }
                // Generate embeddings for the file chunks
                const chunks = this.chunkText(secretScan.redacted, 1000, 200);
                for (let idx = 0; idx < chunks.length; idx++) {
                    const chunkText = chunks[idx];
                    const chunkEmbedding = await ai_service_1.aiService.generateEmbedding(chunkText);
                    await models_1.Embedding.create({
                        userId,
                        projectId,
                        sourceType: 'file',
                        sourceId: fileDoc._id,
                        content: chunkText,
                        vector: chunkEmbedding,
                        metadata: {
                            path: file.relativePath,
                            chunkIndex: idx
                        }
                    });
                }
            }
            onProgress({ status: 'embedding', progress: 90, message: 'Finalizing database entries...' });
            const project = await models_1.Project.findById(projectId, 'name');
            // Create upload activity log
            await models_1.Activity.create({
                userId,
                action: 'project_uploaded',
                entityType: 'project',
                entityId: projectId,
                metadata: { projectName: project?.name || (filesToProcess.length > 0 ? 'Uploaded zip project' : 'Empty project') }
            });
            await notification_service_1.notificationService.create({
                userId,
                title: 'تم تجهيز المشروع',
                message: `اكتملت فهرسة مشروع ${project?.name || 'المشروع المرفوع'} وأصبح جاهزاً للبحث والمحادثة.`,
                type: 'success',
                link: `/projects/${projectId}`,
            });
            // Cleanup local temp directories
            if (fs_1.default.existsSync(tempExtractDir)) {
                fs_1.default.rmSync(tempExtractDir, { recursive: true, force: true });
            }
            if (fs_1.default.existsSync(zipFilePath)) {
                fs_1.default.rmSync(zipFilePath, { force: true });
            }
            onProgress({ status: 'completed', progress: 100, message: 'Project parsed and indexed successfully!' });
        }
        catch (err) {
            console.error('[ProjectProcessor]: Failed to process ZIP:', err);
            // Cleanup on error
            const tempExtractDir = path_1.default.join(__dirname, `../../uploads/temp_${projectId}`);
            if (fs_1.default.existsSync(tempExtractDir)) {
                fs_1.default.rmSync(tempExtractDir, { recursive: true, force: true });
            }
            if (fs_1.default.existsSync(zipFilePath)) {
                fs_1.default.rmSync(zipFilePath, { force: true });
            }
            onProgress({ status: 'failed', progress: 100, message: `Processing failed: ${err.message}` });
            await notification_service_1.notificationService.create({
                userId,
                title: 'فشلت معالجة المشروع',
                message: `تعذر فهرسة المشروع. السبب: ${err.message}`,
                type: 'error',
                link: `/projects/${projectId}`,
            });
            throw err;
        }
    }
    // Simple overlapping text chunker
    chunkText(text, chunkSize, overlap) {
        const chunks = [];
        if (text.length <= chunkSize) {
            return [text];
        }
        let i = 0;
        while (i < text.length) {
            const chunk = text.substring(i, i + chunkSize);
            chunks.push(chunk);
            i += chunkSize - overlap;
        }
        return chunks;
    }
}
exports.projectProcessorService = new ProjectProcessorService();
