import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import ignore from 'ignore';
import mongoose from 'mongoose';
import { Project, File as DBFile, CodeEntity, Embedding, Activity, KnowledgeRelationship } from '../models';
import { storageService } from './storage.service';
import { parserService } from './parser.service';
import { aiService } from './ai.service';
import { notificationService } from './notification.service';
import { scanForSecrets } from '../middleware/security';
import { knowledgeGraphService } from './knowledge-graph.service';


export interface ProcessingProgress {
  status: 'pending' | 'processing' | 'extracting' | 'parsing' | 'embedding' | 'completed' | 'partial' | 'failed';
  progress: number; // 0 to 100
  message: string;
  projectId?: string;
  processedFiles?: number;
  skippedFiles?: number;
  failedFiles?: number;
  indexedFiles?: number;
  embeddingFailures?: number;
  parserWarnings?: number;
  totalFiles?: number;
  warnings?: string[];
  errorCode?: string;
}

interface ProcessingCounters {
  processedFiles: number;
  skippedFiles: number;
  failedFiles: number;
  indexedFiles: number;
  embeddingFailures: number;
  parserWarnings: number;
  totalFiles: number;
  warnings: string[];
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

  private maxFileBytes = 10 * 1024 * 1024;

  private buildProgress(
    projectId: string,
    status: ProcessingProgress['status'],
    progress: number,
    message: string,
    counters: ProcessingCounters,
    errorCode?: string
  ): ProcessingProgress {
    return {
      projectId,
      status,
      progress,
      message,
      processedFiles: counters.processedFiles,
      skippedFiles: counters.skippedFiles,
      failedFiles: counters.failedFiles,
      indexedFiles: counters.indexedFiles,
      embeddingFailures: counters.embeddingFailures,
      parserWarnings: counters.parserWarnings,
      totalFiles: counters.totalFiles,
      warnings: counters.warnings.slice(0, 10),
      errorCode,
    };
  }

  private addWarning(counters: ProcessingCounters, warning: string) {
    counters.warnings.push(warning);
    if (counters.warnings.length > 25) counters.warnings = counters.warnings.slice(-25);
  }

  private isProbablyBinary(buffer: Buffer): boolean {
    if (buffer.length === 0) return false;
    const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
    return sample.includes(0);
  }

  private normalizeZipPath(entryName: string): string | null {
    const normalized = entryName.replace(/\\/g, '/').replace(/^\.\/+/, '');
    if (!normalized || normalized.includes('\0')) return null;
    if (normalized.includes('..') || normalized.startsWith('/') || normalized.startsWith('\\')) return null;
    return path.posix.normalize(normalized);
  }

  private async cleanupProcessingFiles(projectId: string, zipFilePath: string) {
    const tempExtractDir = path.join(__dirname, `../../uploads/temp_${projectId}`);
    await fs.promises.rm(tempExtractDir, { recursive: true, force: true }).catch(() => undefined);
    await fs.promises.rm(zipFilePath, { force: true }).catch(() => undefined);
  }

  async processProjectZip(
    projectId: string,
    userId: string,
    zipFilePath: string,
    onProgress: (progress: ProcessingProgress) => void
  ): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw new Error('Invalid projectId.');
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid userId.');
    }

    const counters: ProcessingCounters = {
      processedFiles: 0,
      skippedFiles: 0,
      failedFiles: 0,
      indexedFiles: 0,
      embeddingFailures: 0,
      parserWarnings: 0,
      totalFiles: 0,
      warnings: [],
    };

    const emit = (
      status: ProcessingProgress['status'],
      progress: number,
      message: string,
      errorCode?: string
    ) => onProgress(this.buildProgress(projectId, status, progress, message, counters, errorCode));

    try {
      const project = await Project.findOne({ _id: projectId, userId }, '_id').lean();
      if (!project) {
        await this.cleanupProcessingFiles(projectId, zipFilePath);
        emit('failed', 100, 'Project no longer exists.', 'PROJECT_NOT_FOUND');
        return;
      }

      emit('extracting', 10, 'Extracting zip file safely...');
      
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
        const normalized = this.normalizeZipPath(entry.entryName);
        if (!normalized) {
          counters.skippedFiles++;
          this.addWarning(counters, 'Skipped unsafe gitignore path.');
          continue;
        }

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
            counters.parserWarnings++;
            this.addWarning(counters, 'Failed to parse a .gitignore file.');
          }
        }
      }

      const filesToProcess: { relativePath: string; content: string; extension: string; size: number }[] = [];
      const seenPaths = new Set<string>();

      for (const entry of zipEntries) {
        if (entry.isDirectory) continue;

        const normalizedPath = this.normalizeZipPath(entry.entryName);
        
        // 1. Prevent Zip-Slip (Directory Traversal)
        if (!normalizedPath) {
          counters.skippedFiles++;
          this.addWarning(counters, 'Skipped unsafe archive path.');
          continue;
        }

        if (seenPaths.has(normalizedPath)) {
          counters.skippedFiles++;
          this.addWarning(counters, `Skipped duplicate file path: ${normalizedPath}`);
          continue;
        }
        seenPaths.add(normalizedPath);

        // 2. Filter out using the .gitignore and default ignore rules
        if (ig.ignores(normalizedPath)) {
          counters.skippedFiles++;
          continue;
        }

        // 3. Fallback: Filter out standard ignored folders directly
        const pathParts = normalizedPath.split('/');
        const isIgnoredFolder = pathParts.some(part => this.ignoredFolders.includes(part));
        if (isIgnoredFolder) {
          counters.skippedFiles++;
          continue;
        }

        // 4. Filter out unsupported files
        const ext = normalizedPath.split('.').pop()?.toLowerCase() || '';
        if (!this.supportedExtensions.includes(ext)) {
          counters.skippedFiles++;
          continue;
        }

        // Extract buffer and safely save
        let fileContentBuffer: Buffer;
        try {
          fileContentBuffer = entry.getData();
        } catch {
          counters.failedFiles++;
          this.addWarning(counters, `Could not read ${normalizedPath}.`);
          continue;
        }
        if (fileContentBuffer.length > this.maxFileBytes) {
          counters.skippedFiles++;
          this.addWarning(counters, `Skipped large file: ${normalizedPath}`);
          continue;
        }
        if (this.isProbablyBinary(fileContentBuffer)) {
          counters.skippedFiles++;
          continue;
        }
        const contentStr = fileContentBuffer.toString('utf8');
        const size = fileContentBuffer.length;

        filesToProcess.push({
          relativePath: normalizedPath,
          content: contentStr,
          extension: ext,
          size
        });
      }

      counters.totalFiles = filesToProcess.length;
      if (filesToProcess.length === 0) {
        emit('failed', 100, 'No processable source files were found in the archive.', 'NO_PROCESSABLE_FILES');
        await Project.findOneAndUpdate(
          { _id: projectId, userId },
          {
            processingStatus: 'failed',
            processingProgress: 100,
            processingMessage: 'No processable source files were found in the archive.',
            processingErrorCode: 'NO_PROCESSABLE_FILES',
            processingStats: counters,
          }
        );
        await this.cleanupProcessingFiles(projectId, zipFilePath);
        return;
      }

      emit('parsing', 30, `Analyzing ${filesToProcess.length} codebase files...`);

      const filesMetadata: { path: string; content: string }[] = filesToProcess.map(f => ({
        path: f.relativePath,
        content: f.content
      }));

      // Detect Project Language, Framework and DB
      const projectDetails = parserService.detectFrameworkAndDB(filesMetadata);
      await Project.findOneAndUpdate({ _id: projectId, userId }, {
        language: projectDetails.language,
        framework: projectDetails.framework,
        database: projectDetails.database,
        healthScore: 100, // default initial score
        processingStatus: 'processing',
        processingErrorCode: undefined,
        processingStats: counters,
      });

      // Reprocessing must be idempotent for a project. Remove previous derived
      // records before writing fresh file/entity/embedding/relationship records.
      await Promise.all([
        DBFile.deleteMany({ projectId }),
        CodeEntity.deleteMany({ projectId }),
        Embedding.deleteMany({ projectId }),
        KnowledgeRelationship.deleteMany({ projectId }),
        storageService.deleteProjectFiles(projectId),
      ]);

      // Save files to MongoDB and store in Local Storage
      const dbFileIds: string[] = [];
      let currentFileIndex = 0;

      for (const file of filesToProcess) {
        currentFileIndex++;
        const filePercent = 30 + Math.floor((currentFileIndex / filesToProcess.length) * 30);
        emit('parsing', filePercent, `Parsing [${currentFileIndex}/${filesToProcess.length}] ${path.basename(file.relativePath)}...`);

        try {
          // Scan for potential secrets
          const secretScan = scanForSecrets(file.content);

          // Save file content to storage
          await storageService.saveFile(
            projectId,
            file.relativePath,
            secretScan.redacted
          );

          let summary = '';
          try {
            summary = await aiService.generateSummary(
              path.basename(file.relativePath),
              secretScan.redacted.substring(0, 5000),
              file.extension
            );
          } catch {
            counters.parserWarnings++;
            this.addWarning(counters, `Summary unavailable for ${file.relativePath}.`);
            summary = 'Summary unavailable.';
          }

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
          counters.processedFiles++;

          let entities: ReturnType<typeof parserService.extractEntities> = [];
          try {
            entities = parserService.extractEntities(secretScan.redacted, fileDoc.language || 'text');
          } catch {
            counters.parserWarnings++;
            this.addWarning(counters, `Parser warning for ${file.relativePath}.`);
            entities = [];
          }
          
          for (const entity of entities) {
            try {
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
                dependencies: entity.dependencies,
                tags: [],
                metadata: {
                  language: entity.language,
                  exported: entity.exported || false,
                  async: entity.async || false,
                  routeMethod: entity.routeMethod,
                  routePath: entity.routePath,
                  imports: entity.imports || [],
                  confidence: entity.confidence,
                  parser: entity.parser,
                },
              });

              // Generate embedding for CodeEntity
              try {
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
              } catch {
                counters.embeddingFailures++;
                this.addWarning(counters, `Embedding failed for entity ${entity.name}.`);
              }
            } catch {
              counters.parserWarnings++;
              this.addWarning(counters, `Entity indexing warning in ${file.relativePath}.`);
            }
          }

          // Generate embeddings for the file chunks
          const chunks = this.chunkText(secretScan.redacted, 1000, 200);
          for (let idx = 0; idx < chunks.length; idx++) {
            const chunkText = chunks[idx];
            try {
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
            } catch {
              counters.embeddingFailures++;
              this.addWarning(counters, `Embedding failed for ${file.relativePath}.`);
            }
          }

          counters.indexedFiles++;
        } catch {
          counters.failedFiles++;
          this.addWarning(counters, `Failed to process ${file.relativePath}.`);
        }
      }

      emit('embedding', 90, 'Finalizing database entries...');

      const projectDoc = await Project.findById(projectId, 'name');

      // Create upload activity log
      await Activity.create({
        userId,
        action: 'project_uploaded',
        entityType: 'project',
        entityId: projectId,
        metadata: { projectName: projectDoc?.name || (filesToProcess.length > 0 ? 'Uploaded zip project' : 'Empty project') }
      });

      const finalStatus: ProcessingProgress['status'] = counters.failedFiles > 0 || counters.embeddingFailures > 0 || counters.parserWarnings > 0
        ? 'partial'
        : 'completed';

      await notificationService.create({
        userId,
        title: finalStatus === 'partial' ? 'اكتملت فهرسة المشروع جزئياً' : 'تم تجهيز المشروع',
        message: finalStatus === 'partial'
          ? `اكتملت فهرسة مشروع ${projectDoc?.name || 'المشروع المرفوع'} مع بعض التحذيرات.`
          : `اكتملت فهرسة مشروع ${projectDoc?.name || 'المشروع المرفوع'} وأصبح جاهزاً للبحث والمحادثة.`,
        type: finalStatus === 'partial' ? 'warning' : 'success',
        link: `/projects/${projectId}`,
      });


      // Cleanup local temp directories
      await this.cleanupProcessingFiles(projectId, zipFilePath);

      const finalMessage = finalStatus === 'partial'
        ? 'Project indexed with warnings.'
        : 'Project parsed and indexed successfully!';
      emit(finalStatus, 100, finalMessage);

      // Build knowledge graph relationships fire-and-forget.
      // Failures MUST NOT affect project processing outcome.
      knowledgeGraphService.buildRelationshipsForProject(projectId).catch((graphErr: any) => {
        const msg = graphErr instanceof Error ? graphErr.message : String(graphErr);
        console.warn(`[ProjectProcessor]: Knowledge graph build failed safely for ${projectId} — ${msg}`);
      });

    } catch (err: any) {
      console.error('[ProjectProcessor]: Failed to process ZIP safely.');
      // Cleanup on error
      await this.cleanupProcessingFiles(projectId, zipFilePath);
      emit('failed', 100, 'Project processing failed.', 'PROJECT_PROCESSING_FAILED');
      await notificationService.create({
        userId,
        title: 'فشلت معالجة المشروع',
        message: 'تعذر فهرسة المشروع. حاول إعادة رفع ملف ZIP بعد التحقق من محتواه.',
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
