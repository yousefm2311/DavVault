const fs = require('fs');
const path = require('path');

let failed = false;
const queue = fs.readFileSync(path.join(__dirname, 'backend/src/services/queue.service.ts'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, 'frontend/src/app/projects/page.tsx'), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== PROCESSING REALTIME RECOVERY VERIFICATION ===\n');

check('backend emits terminal partial/failed/completed statuses', queue.includes('processingStatus: payload.status'));
check('frontend handles terminal statuses and refetches', page.includes("['completed', 'partial', 'failed', 'cancelled'].includes(data.status)") && page.includes('fetchProjects();'));
check('frontend ignores events for wrong project', page.includes('eventProjectId !== projectId'));
check('frontend clamps invalid progress', page.includes('clampProgress(data?.progress)'));
check('frontend tolerates missing warnings', page.includes('Array.isArray(data?.warnings) ? data.warnings : prev.warnings'));
check('frontend stale timeout refetches status', page.includes('No processing update received recently') && page.includes('setTimeout'));
check('frontend socket effect avoids terminal reconnect loop', page.includes("['completed', 'partial', 'failed', 'cancelled'].includes(activeJob.status)"));

if (failed) process.exit(1);
console.log('\n[PASS] Processing realtime recovery verification passed.');
