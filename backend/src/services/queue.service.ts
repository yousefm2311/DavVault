import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
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
        
        await projectProcessorService.processProjectZip(
          projectId,
          userId,
          zipFilePath,
          (progress) => {
            this.broadcastProgress(projectId, progress);
          }
        );
      },
      { connection: workerConnection }
    );

    this.projectWorker.on('completed', (job) => {
      console.log(`[Queue Service/BullMQ]: Job ${job.id} completed!`);
    });

    this.projectWorker.on('failed', (job, err) => {
      console.error(`[Queue Service/BullMQ]: Job ${job?.id} failed:`, err);
    });
  }

  private setupMemoryQueueFallback() {
    if (this.projectQueue) return; // BullMQ already set up
    console.warn(
      '[Queue Service]: Redis is offline. Running background projects through in-memory queue fallback.'
    );
  }

  async addJob(projectId: string, userId: string, zipFilePath: string): Promise<void> {
    const jobData: JobData = { projectId, userId, zipFilePath };

    if (this.projectQueue) {
      // Use BullMQ if active
      await this.projectQueue.add(`job_${projectId}_${Date.now()}`, jobData, {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      });
      console.log(`[Queue Service/BullMQ]: Job added to Redis queue for project ${projectId}`);
    } else {
      // Fallback: Add to memory queue
      this.memoryQueue.push(jobData);
      console.log(`[Queue Service/Memory]: Job added to local memory queue for project ${projectId}`);
      this.processMemoryQueue();
    }
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
        await projectProcessorService.processProjectZip(
          job.projectId,
          job.userId,
          job.zipFilePath,
          (progress) => {
            this.broadcastProgress(job.projectId, progress);
          }
        );
      } catch (err) {
        console.error(`[Queue Service/Memory]: Failed memory job for project ${job.projectId}:`, err);
      }
    }

    this.isProcessingMemoryQueue = false;
    // Process next item in queue asynchronously
    setImmediate(() => this.processMemoryQueue());
  }

  private broadcastProgress(projectId: string, progress: any) {
    void Project.findByIdAndUpdate(projectId, {
      processingStatus: progress.status,
      processingProgress: progress.progress,
      processingMessage: progress.message,
    });
    if (this.io) {
      // Emit to room specific to project
      this.io.to(`project_${projectId}`).emit('processing_progress', progress);
      // Also emit generally
      this.io.emit(`project_${projectId}_progress`, progress);
    }
  }
}

export const queueService = new QueueService();
