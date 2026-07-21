const fs = require('fs');
const path = require('path');

let failed = false;
const queue = fs.readFileSync(path.join(__dirname, 'backend/src/services/queue.service.ts'), 'utf8');
const notificationController = fs.readFileSync(path.join(__dirname, 'backend/src/controllers/notification.controller.ts'), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== REALTIME EVENT PAYLOAD SAFETY VERIFICATION ===\n');

check('progress payload is plain object, not Mongo document', queue.includes('const payload = {') && queue.includes('emit(\'processing_progress\', payload)'));
check('progress payload has normalized projectId string', queue.includes('projectId,') && queue.includes('mongoose.Types.ObjectId.isValid(projectId)'));
check('progress payload includes stable required fields', ['status', 'progress', 'processedFiles', 'totalFiles', 'skippedFiles', 'failedFiles', 'warnings', 'errorCode', 'updatedAt'].every((field) => queue.includes(field)));
check('progress payload truncates warning list', queue.includes('warnings.slice(0, 10)'));
check('progress DB write is scoped by userId', queue.includes('Project.findOneAndUpdate({ _id: projectId, userId }'));
check('notification payload normalizes IDs and dates', notificationController.includes('_id: notification._id?.toString()') && notificationController.includes('toISOString()'));
check('payload code does not include stack traces or raw errors', !queue.includes('err.stack') && !notificationController.includes('err.stack'));

if (failed) process.exit(1);
console.log('\n[PASS] Realtime event payload safety verification passed.');
