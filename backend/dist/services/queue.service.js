"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueService = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const project_processor_service_1 = require("./project-processor.service");
class QueueService {
    redisConnection = null;
    projectQueue = null;
    projectWorker = null;
    io = null;
    // Memory queue fallback when Redis is offline
    memoryQueue = [];
    isProcessingMemoryQueue = false;
    init(io) {
        this.io = io;
        const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
        try {
            console.log('[Queue Service]: Attempting connection to Redis...');
            this.redisConnection = new ioredis_1.default(redisUrl, {
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
        }
        catch (e) {
            console.error('[Queue Service]: Redis connection initialization failed:', e.message);
            this.setupMemoryQueueFallback();
        }
    }
    setupBullMQ(redisUrl) {
        const queueConnection = new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: null,
        });
        const workerConnection = new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: null,
        });
        this.projectQueue = new bullmq_1.Queue('project-processing', {
            connection: queueConnection,
        });
        this.projectWorker = new bullmq_1.Worker('project-processing', async (job) => {
            const { projectId, userId, zipFilePath } = job.data;
            console.log(`[Queue Service/BullMQ]: Starting job ${job.id} for project ${projectId}`);
            await project_processor_service_1.projectProcessorService.processProjectZip(projectId, userId, zipFilePath, (progress) => {
                this.broadcastProgress(projectId, progress);
            });
        }, { connection: workerConnection });
        this.projectWorker.on('completed', (job) => {
            console.log(`[Queue Service/BullMQ]: Job ${job.id} completed!`);
        });
        this.projectWorker.on('failed', (job, err) => {
            console.error(`[Queue Service/BullMQ]: Job ${job?.id} failed:`, err);
        });
    }
    setupMemoryQueueFallback() {
        if (this.projectQueue)
            return; // BullMQ already set up
        console.warn('[Queue Service]: Redis is offline. Running background projects through in-memory queue fallback.');
    }
    async addJob(projectId, userId, zipFilePath) {
        const jobData = { projectId, userId, zipFilePath };
        if (this.projectQueue) {
            // Use BullMQ if active
            await this.projectQueue.add(`job_${projectId}_${Date.now()}`, jobData, {
                attempts: 1,
                removeOnComplete: true,
                removeOnFail: true,
            });
            console.log(`[Queue Service/BullMQ]: Job added to Redis queue for project ${projectId}`);
        }
        else {
            // Fallback: Add to memory queue
            this.memoryQueue.push(jobData);
            console.log(`[Queue Service/Memory]: Job added to local memory queue for project ${projectId}`);
            this.processMemoryQueue();
        }
    }
    async processMemoryQueue() {
        if (this.isProcessingMemoryQueue || this.memoryQueue.length === 0)
            return;
        this.isProcessingMemoryQueue = true;
        const job = this.memoryQueue.shift();
        if (job) {
            console.log(`[Queue Service/Memory]: Processing project ${job.projectId} in background memory queue...`);
            try {
                await project_processor_service_1.projectProcessorService.processProjectZip(job.projectId, job.userId, job.zipFilePath, (progress) => {
                    this.broadcastProgress(job.projectId, progress);
                });
            }
            catch (err) {
                console.error(`[Queue Service/Memory]: Failed memory job for project ${job.projectId}:`, err);
            }
        }
        this.isProcessingMemoryQueue = false;
        // Process next item in queue asynchronously
        setImmediate(() => this.processMemoryQueue());
    }
    broadcastProgress(projectId, progress) {
        if (this.io) {
            // Emit to room specific to project
            this.io.to(`project_${projectId}`).emit('processing_progress', progress);
            // Also emit generally
            this.io.emit(`project_${projectId}_progress`, progress);
        }
    }
}
exports.queueService = new QueueService();
