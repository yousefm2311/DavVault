const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== PROCESSING SOCKET EVENTS VERIFICATION ===\n');

const queue = read('backend/src/services/queue.service.ts');
const index = read('backend/src/index.ts');
const page = read('frontend/src/app/projects/page.tsx');

check('progress broadcast validates projectId and userId', queue.includes('isValid(projectId)') && queue.includes('isValid(userId)'));
check('progress DB writes are project and owner scoped', queue.includes('Project.findOneAndUpdate({ _id: projectId, userId }'));
check('progress payload includes stable counters', ['projectId', 'status', 'progress', 'processedFiles', 'totalFiles', 'skippedFiles', 'failedFiles', 'warnings', 'errorCode', 'updatedAt'].every((v) => queue.includes(v)));
check('socket room names use normalized project id', index.includes('normalizeSocketProjectId') && index.includes('project_${normalizedProjectId}'));
check('join_project validates socket user id before Mongoose', index.includes('Ignoring project join without valid socket user id'));
check('frontend ignores progress events for wrong project', page.includes('eventProjectId !== projectId'));
check('frontend tolerates missing partial payloads', page.includes('clampProgress') && page.includes('Array.isArray(data?.warnings)'));
check('frontend refetches after terminal states', page.includes("['completed', 'partial', 'failed', 'cancelled'].includes(data.status)"));

if (failed) process.exit(1);
console.log('\n[PASS] Processing socket events verification passed.');
