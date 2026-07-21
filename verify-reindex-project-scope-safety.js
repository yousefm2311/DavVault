const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== REINDEX PROJECT SCOPE SAFETY VERIFICATION ===\n');

const scriptPath = 'scripts/reindex-snippet-embeddings-projectid.js';
const script = read(scriptPath);
const processor = read('backend/src/services/project-processor.service.ts');

check('snippet embedding reindex helper exists', fs.existsSync(path.join(__dirname, scriptPath)));
check('reindex helper defaults to dry run', script.includes("APPLY_REINDEX === 'true'") && script.includes('dryRun: !apply'));
check('reindex helper only targets snippet embeddings', script.includes("sourceType: 'snippet'"));
check('reindex helper requires snippet sourceProjectId', script.includes('sourceProjectId: { $exists: true, $ne: null }'));
check('reindex helper scopes by userId and sourceId', script.includes('userId: snippet.userId') && script.includes('sourceId: snippet._id'));
check('reindex helper only fills missing projectId', script.includes("projectId: { $exists: false }") && script.includes('{ projectId: null }'));
check('reindex helper does not delete data', !script.includes('deleteMany') && !script.includes('drop('));
check('project reprocessing clears only project-scoped derived records', processor.includes('deleteMany({ projectId })'));

if (failed) process.exit(1);
console.log('\n[PASS] Reindex project scope safety verification passed.');
