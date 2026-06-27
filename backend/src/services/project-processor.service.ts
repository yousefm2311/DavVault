import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import ignore from 'ignore';
import { Project, File as DBFile, CodeEntity, Embedding, Activity } from '../models';
import { storageService } from './storage.service';
import { parserService } from './parser.service';
import { aiService } from './ai.service';
import { notificationService } from './notification.service';
import { scanForSecrets } from '../middleware/security';

export interface ProcessingProgress {
  status: 'pending' | 'extracting' | 'parsing' | 'embedding' | 'completed' | 'failed';
  progress: number; // 0 to 100
  message: string;
}

class ProjectProcessorService {
  // Safe directories checks (fallback if no .gitignore)
  private ignoredFolders = [
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

  // Extended to support all major programming, markup, styling, shell, and DB languages
  private supportedExtensions = [
    'js', 'jsx', 'ts', 'tsx', 'py', 'dart', 'php', 'java',
    'go', 'rs', 'c', 'h', 'cpp', 'hpp', 'cc', 'cxx', 'cs',
    'rb', 'swift', 'kt', 'kts', 'html', 'css', 'scss',
    'sass', 'less', 'sql', 'sh', 'bash', 'json', 'md',
    'txt', 'yml', 'yaml', 'env'
  ];

  async processProjectZip(
    projectId: string,
    userId: string,
    zipFilePath: string,
    onProgress: (progress: ProcessingProgress) => void
  ): Promise<void> {
    try {
      onProgress({ status: 'extracting', progress: 10, message: 'Extracting zip file safely...' });
      
      const zip = new AdmZip(zipFilePath);
      const zipEntries = zip.getEntries();
      
      // Temporary directory for zip extraction
      const tempExtractDir = path.join(__dirname, `../../uploads/temp_${projectId}`);
      if (!fs.existsSync(tempExtractDir)) {
        fs.mkdirSync(tempExtractDir, { recursive: true });
      }

      // Initialize the ignore instance and add default ignores
      const ig = ignore();
      ig.add([
        '.git/**',
        '.github/**',
        'node_modules/**',
        'dist/**',
        'build/**',
        '.idea/**',
        '.vscode/**',
        '*.zip',
        '*.tar.gz'
      ]);

      // First pass: Find all .gitignore files and read/parse their rules
      for (const entry of zipEntries) {
        if (entry.isDirectory) continue;
        const entryName = entry.entryName;
        const normalized = entryName.replace(/\\/g, '/');

        if (normalized.endsWith('.gitignore')) {
          try {
            const content = entry.getData().toString('utf8');
            const rules = content.split('\n')
              .map(line => line.trim())
              .filter(line => line && !line.startsWith('#'));

            const dirName = path.dirname(normalized);
            const relativeRules = rules.map(rule => {
              if (dirName === '.' || dirName === '') {
                return rule;
              }
              if (rule.startsWith('/')) {
                return `${dirName}${rule}`;
              }
              return `${dirName}/**/${rule}`;
            });

            ig.add(relativeRules);
          } catch (e: any) {
            console.error(`[ProjectProcessor]: Failed to parse gitignore ${entryName}:`, e.message);
          }
        }
      }

      const filesToProcess: { relativePath: string; content: string; extension: string; size: number }[] = [];

      for (const entry of zipEntries) {
        if (entry.isDirectory) continue;

        const entryName = entry.entryName;
        const normalizedPath = entryName.replace(/\\/g, '/');
        
        // 1. Prevent Zip-Slip (Directory Traversal)
        if (normalizedPath.includes('..') || normalizedPath.startsWith('/') || normalizedPath.startsWith('\\')) {
          console.warn(`[ProjectProcessor]: Blocked potential Zip-Slip entry: ${entryName}`);
          continue;
        }

        // 2. Filter out using the .gitignore and default ignore rules
        if (ig.ignores(normalizedPath)) {
          continue;
        }

        // 3. Fallback: Filter out standard ignored folders directly
        const pathParts = normalizedPath.split('/');
        const isIgnoredFolder = pathParts.some(part => this.ignoredFolders.includes(part));
        if (isIgnoredFolder) {
          continue;
        }

        // 4. Filter out unsupported files
        const ext = normalizedPath.split('.').pop()?.toLowerCase() || '';
        if (!this.supportedExtensions.includes(ext)) continue;

        // Extract buffer and safely save
        const fileContentBuffer = entry.getData();
        const contentStr = fileContentBuffer.toString('utf8');
        const size = fileContentBuffer.length;

        filesToProcess.push({
          relativePath: normalizedPath,
          content: contentStr,
          extension: ext,
          size
        });
      }

      onProgress({ status: 'parsing', progress: 30, message: `Analyzing ${filesToProcess.length} codebase files...` });

      const filesMetadata: { path: string; content: string }[] = filesToProcess.map(f => ({
        path: f.relativePath,
        content: f.content
      }));

      // Detect Project Language, Framework and DB
      const projectDetails = parserService.detectFrameworkAndDB(filesMetadata);
      await Project.findByIdAndUpdate(projectId, {
        language: projectDetails.language,
        framework: projectDetails.framework,
        database: projectDetails.database,
        healthScore: 100 // default initial score
      });

      // Save files to MongoDB and store in Local Storage
      const dbFileIds: string[] = [];
      let currentFileIndex = 0;

      for (const file of filesToProcess) {
        currentFileIndex++;
        const filePercent = 30 + Math.floor((currentFileIndex / filesToProcess.length) * 30);
        onProgress({
          status: 'parsing',
          progress: filePercent,
          message: `Parsing [${currentFileIndex}/${filesToProcess.length}] ${path.basename(file.relativePath)}...`
        });

        // Scan for potential secrets
        const secretScan = scanForSecrets(file.content);

        // Save file content to storage
        const storagePath = await storageService.saveFile(
          projectId,
          file.relativePath,
          secretScan.redacted
        );

        // Generate file summary (limit summary size for faster runs)
        const summary = await aiService.generateSummary(
          path.basename(file.relativePath),
          secretScan.redacted.substring(0, 5000),
          file.extension
        );

        // Create file document
        const fileDoc = await DBFile.create({
          projectId,
          userId,
          path: file.relativePath,
          fileName: path.basename(file.relativePath),
          extension: file.extension,
          size: file.size,
          content: secretScan.redacted,
          summary,
          language: parserService.detectLanguage(file.relativePath)
        });

        dbFileIds.push(fileDoc._id.toString());

        // Extract entities (Classes, Functions, Routes)
        const entities = parserService.extractEntities(secretScan.redacted, fileDoc.language || 'text');
        
        for (const entity of entities) {
          const entitySummary = `Entity: ${entity.name} (${entity.type}) in ${fileDoc.fileName}.`;
          
          const codeEntityDoc = await CodeEntity.create({
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
          const entityEmbeddingVector = await aiService.generateEmbedding(entity.code);
          await Embedding.create({
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
          const chunkEmbedding = await aiService.generateEmbedding(chunkText);
          
          await Embedding.create({
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

      const project = await Project.findById(projectId, 'name');

      // Create upload activity log
      await Activity.create({
        userId,
        action: 'project_uploaded',
        entityType: 'project',
        entityId: projectId,
        metadata: { projectName: project?.name || (filesToProcess.length > 0 ? 'Uploaded zip project' : 'Empty project') }
      });

      await notificationService.create({
        userId,
        title: 'تم تجهيز المشروع',
        message: `اكتملت فهرسة مشروع ${project?.name || 'المشروع المرفوع'} وأصبح جاهزاً للبحث والمحادثة.`,
        type: 'success',
        link: `/projects/${projectId}`,
      });

      // Cleanup local temp directories
      if (fs.existsSync(tempExtractDir)) {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      }
      if (fs.existsSync(zipFilePath)) {
        fs.rmSync(zipFilePath, { force: true });
      }

      onProgress({ status: 'completed', progress: 100, message: 'Project parsed and indexed successfully!' });
    } catch (err: any) {
      console.error('[ProjectProcessor]: Failed to process ZIP:', err);
      // Cleanup on error
      const tempExtractDir = path.join(__dirname, `../../uploads/temp_${projectId}`);
      if (fs.existsSync(tempExtractDir)) {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      }
      if (fs.existsSync(zipFilePath)) {
        fs.rmSync(zipFilePath, { force: true });
      }
      onProgress({ status: 'failed', progress: 100, message: `Processing failed: ${err.message}` });
      await notificationService.create({
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
  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
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

export const projectProcessorService = new ProjectProcessorService();
