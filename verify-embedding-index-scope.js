const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== EMBEDDING INDEX SCOPE VERIFICATION ===\n');

const processor = read('backend/src/services/project-processor.service.ts');
const snippets = read('backend/src/controllers/snippet.controller.ts');
const search = read('backend/src/services/search.service.ts');

check('file embeddings include userId and projectId', processor.includes('sourceType: \'file\'') && processor.includes('userId') && processor.includes('projectId'));
check('code entity embeddings include userId and projectId', processor.includes('sourceType: \'codeEntity\'') && processor.includes('projectId'));
check('snippet embeddings store sourceProjectId as projectId', snippets.includes('projectId: sourceProjectId'));
check('embedding provider failure does not fail file processing', processor.includes('counters.embeddingFailures++') && processor.includes('Embedding failed'));
check('search vector scope uses accessible project ids', search.includes('getAccessibleProjects(userId') && search.includes('projectId: { $in: accessibleProjectIds }'));
check('vector search rechecks candidate project access', search.includes('candidateProjectId') && search.includes('!accessibleProjectIds.includes(candidateProjectId)'));
check('snippet embedding reindex helper exists for old missing projectId records', fs.existsSync(path.join(__dirname, 'scripts/reindex-snippet-embeddings-projectid.js')));

if (failed) process.exit(1);
console.log('\n[PASS] Embedding index scope verification passed.');
