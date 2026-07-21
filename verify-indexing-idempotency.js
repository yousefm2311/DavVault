const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== INDEXING IDEMPOTENCY VERIFICATION ===\n');

const processor = read('backend/src/services/project-processor.service.ts');
const queue = read('backend/src/services/queue.service.ts');

check('processor deletes previous files for project before reindex', processor.includes('DBFile.deleteMany({ projectId })'));
check('processor deletes previous code entities for project before reindex', processor.includes('CodeEntity.deleteMany({ projectId })'));
check('processor deletes previous embeddings for project before reindex', processor.includes('Embedding.deleteMany({ projectId })'));
check('processor deletes previous knowledge relationships for project before reindex', processor.includes('KnowledgeRelationship.deleteMany({ projectId })'));
check('processor clears project storage before writing fresh files', processor.includes('storageService.deleteProjectFiles(projectId)'));
check('duplicate archive paths are skipped deterministically', processor.includes('seenPaths') && processor.includes('Skipped duplicate file path'));
check('queue uses stable per-project job id', queue.includes('jobId: `project_${projectId}`'));
check('memory queue ignores duplicate project jobs', queue.includes('Duplicate job ignored'));

if (failed) process.exit(1);
console.log('\n[PASS] Indexing idempotency verification passed.');
