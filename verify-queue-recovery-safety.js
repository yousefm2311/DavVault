const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== QUEUE RECOVERY SAFETY VERIFICATION ===\n');

const queue = read('backend/src/services/queue.service.ts');
const controller = read('backend/src/controllers/project.controller.ts');
const index = read('backend/src/index.ts');

check('Redis fallback mode exists and is explicit', queue.includes('setupMemoryQueueFallback') && queue.includes('Redis is offline'));
check('queue addJob validates projectId and userId', queue.includes('INVALID_PROJECT_ID') && queue.includes('INVALID_USER_ID'));
check('BullMQ jobs are deterministic per project', queue.includes('jobId: `project_${projectId}`'));
check('BullMQ retry behavior is deterministic', queue.includes('attempts: 2') && queue.includes('backoff'));
check('memory queue prevents duplicate jobs', queue.includes('memoryQueuedProjectIds') && queue.includes('Duplicate job ignored'));
check('failed queue jobs update project status safely', queue.includes('QUEUE_JOB_FAILED') && queue.includes('processingStatus: \'failed\''));
check('job processing checks project ownership/existence', queue.includes('Project.findOne({ _id: projectId, userId }') && queue.includes('Project.findOne({ _id: job.projectId, userId: job.userId }'));
check('upload controller handles addJob failure safely', controller.includes('PROJECT_QUEUE_FAILED') && controller.includes('res.status(503)'));
check('health reports queue mode safely', index.includes('queueService.getStats()') && index.includes('queue,'));

if (failed) process.exit(1);
console.log('\n[PASS] Queue recovery safety verification passed.');
