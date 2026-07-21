import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import mongoose from 'mongoose';
import { projectProcessorService } from './project-processor.service';
import { Server } from 'socket.io';
import { Project } from '../models';

export interface JobData {
  projectId: string;
  userId: string;
  zipFilePath: string;
}

class QueueService {
  private redisConnection: IORedis | null = null;
  private projectQueue: Queue | null = null;
  private projectWorker: Worker | null = null;
  private io: Server | null = null;

  // Memory queue fallback when Redis is offline
  private memoryQueue: JobData[] = [];
  private isProcessingMemoryQueue = false;
  private memoryQueuedProjectIds = new Set<string>();

  init(io: Server) {
    this.io = io;
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

    try {
      console.log('[Queue Service]: Attempting connection to Redis...');
      this.redisConnection = new IORedis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 2000,
      });

      this.redisConnection.on('connect', () => {
        console.log('[Queue Service]: Redis connected! Initializing BullMQ...');
        this.setupBullMQ(redisUrl);
      });

      this.redisConnection.on('error', (err) => {
        console.warn('[Queue Service]: Redis connection error:', err.message);
        this.setupMemoryQueueFallback();
      });
    } catch (e: any) {
      console.error('[Queue Service]: Redis connection initialization failed:', e.message);
      this.setupMemoryQueueFallback();
    }
  }

  private setupBullMQ(redisUrl: string) {
    const queueConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    const workerConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.projectQueue = new Queue('project-processing', {
      connection: queueConnection,
    });

    this.projectWorker = new Worker(
      'project-processing',
      async (job) => {
        const { projectId, userId, zipFilePath } = job.data as JobData;
        console.log(`[Queue Service/BullMQ]: Starting job ${job.id} for project ${projectId}`);
        const project = await Project.findOne({ _id: projectId, userId }, '_id').lean();
        if (!project) {
          console.warn(`[Queue Service/BullMQ]: Skipping job ${job.id}; project is missing or no longer owned by job user.`);
          return;
        }
        
        await projectProcessorService.processProjectZip(
          projectId,
          userId,
          zipFilePath,
          (progress) => {
            this.broadcastProgress(projectId, userId, progress);
          }
        );
      },
      { connection: workerConnection }
    );

    this.projectWorker.on('completed', (job) => {
      console.log(`[Queue Service/BullMQ]: Job ${job.id} completed!`);
    });

    this.projectWorker.on('failed', (job, err) => {
      const data = job?.data as JobData | undefined;
      console.error(`[Queue Service/BullMQ]: Job ${job?.id} failed safely.`);
      if (data && mongoose.Types.ObjectId.isValid(data.projectId) && mongoose.Types.ObjectId.isValid(data.userId)) {
        void Project.findOneAndUpdate(
          { _id: data.projectId, userId: data.userId },
          {
            processingStatus: 'failed',
            processingProgress: 100,
            processingMessage: 'Indexing job failed.',
            processingErrorCode: 'QUEUE_JOB_FAILED',
          }
        );
      }
    });
  }

  private setupMemoryQueueFallback() {
    if (this.projectQueue) return; // BullMQ already set up
    console.warn(
      '[Queue Service]: Redis is offline. Running background projects through in-memory queue fallback.'
    );
  }

  async addJob(projectId: string, userId: string, zipFilePath: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw new Error('INVALID_PROJECT_ID');
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('INVALID_USER_ID');
    }

    const jobData: JobData = { projectId, userId, zipFilePath };

    if (this.projectQueue) {
      // Use BullMQ if active
      await this.projectQueue.add(`job_${projectId}`, jobData, {
        jobId: `project_${projectId}`,
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      });
      console.log(`[Queue Service/BullMQ]: Job added to Redis queue for project ${projectId}`);
    } else {
      // Fallback: Add to memory queue
      if (this.memoryQueuedProjectIds.has(projectId)) {
        console.log(`[Queue Service/Memory]: Duplicate job ignored for project ${projectId}`);
        return;
      }
      this.memoryQueue.push(jobData);
      this.memoryQueuedProjectIds.add(projectId);
      console.log(`[Queue Service/Memory]: Job added to local memory queue for project ${projectId}`);
      this.processMemoryQueue();
    }
  }

  getMode(): 'bullmq' | 'memory' {
    return this.projectQueue ? 'bullmq' : 'memory';
  }

  async getStats() {
    if (this.projectQueue) {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.projectQueue.getWaitingCount(),
        this.projectQueue.getActiveCount(),
        this.projectQueue.getCompletedCount(),
        this.projectQueue.getFailedCount(),
        this.projectQueue.getDelayedCount(),
      ]);

      return {
        mode: 'bullmq',
        waiting,
        active,
        completed,
        failed,
        delayed,
      };
    }

    return {
      mode: 'memory',
      waiting: this.memoryQueue.length,
      active: this.isProcessingMemoryQueue ? 1 : 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    };
  }

  private async processMemoryQueue() {
    if (this.isProcessingMemoryQueue || this.memoryQueue.length === 0) return;

    this.isProcessingMemoryQueue = true;
    const job = this.memoryQueue.shift();

    if (job) {
      console.log(`[Queue Service/Memory]: Processing project ${job.projectId} in background memory queue...`);
      try {
        const project = await Project.findOne({ _id: job.projectId, userId: job.userId }, '_id').lean();
        if (!project) {
          console.warn(`[Queue Service/Memory]: Skipping project ${job.projectId}; project is missing or no longer owned by job user.`);
        } else {
          await projectProcessorService.processProjectZip(
            job.projectId,
            job.userId,
            job.zipFilePath,
            (progress) => {
              this.broadcastProgress(job.projectId, job.userId, progress);
            }
          );
        }
      } catch (err) {
        console.error(`[Queue Service/Memory]: Failed memory job for project ${job.projectId} safely.`);
        if (mongoose.Types.ObjectId.isValid(job.projectId) && mongoose.Types.ObjectId.isValid(job.userId)) {
          void Project.findOneAndUpdate(
            { _id: job.projectId, userId: job.userId },
            {
              processingStatus: 'failed',
              processingProgress: 100,
              processingMessage: 'Indexing job failed.',
              processingErrorCode: 'QUEUE_JOB_FAILED',
            }
          );
        }
      } finally {
        this.memoryQueuedProjectIds.delete(job.projectId);
      }
    }

    this.isProcessingMemoryQueue = false;
    // Process next item in queue asynchronously
    setImmediate(() => this.processMemoryQueue());
  }

  private broadcastProgress(projectId: string, userId: string, progress: any) {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      console.warn(`[Queue Service]: Ignoring progress broadcast for invalid project id ${projectId}`);
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.warn(`[Queue Service]: Ignoring progress broadcast for invalid user id`);
      return;
    }

    const payload = {
      projectId,
      status: progress.status || 'processing',
      progress: Number.isFinite(Number(progress.progress)) ? Number(progress.progress) : 0,
      message: progress.message || '',
      processedFiles: progress.processedFiles || 0,
      skippedFiles: progress.skippedFiles || 0,
      failedFiles: progress.failedFiles || 0,
      indexedFiles: progress.indexedFiles || 0,
      embeddingFailures: progress.embeddingFailures || 0,
      parserWarnings: progress.parserWarnings || 0,
      totalFiles: progress.totalFiles || 0,
      warnings: Array.isArray(progress.warnings) ? progress.warnings.slice(0, 10) : [],
      errorCode: progress.errorCode,
      updatedAt: new Date().toISOString(),
    };

    void Project.findOneAndUpdate({ _id: projectId, userId }, {
      processingStatus: payload.status,
      processingProgress: payload.progress,
      processingMessage: payload.message,
      processingErrorCode: payload.errorCode,
      processingStats: {
        processedFiles: payload.processedFiles,
        skippedFiles: payload.skippedFiles,
        failedFiles: payload.failedFiles,
        indexedFiles: payload.indexedFiles,
        embeddingFailures: payload.embeddingFailures,
        parserWarnings: payload.parserWarnings,
        totalFiles: payload.totalFiles,
        warnings: payload.warnings,
      },
    });
    if (this.io) {
      // Emit to room specific to project
      this.io.to(`project_${projectId}`).emit('processing_progress', payload);
      // Also emit generally
      this.io.emit(`project_${projectId}_progress`, payload);
    }
  }
}

export const queueService = new QueueService();
