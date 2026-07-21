const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== SEARCH ERROR CONTRACT VERIFICATION ===\n');

const controller = read('backend/src/controllers/search.controller.ts');
const service = read('backend/src/services/search.service.ts');
const palette = read('frontend/src/components/CommandPalette.tsx');

check('search query required response is structured', controller.includes('SEARCH_QUERY_REQUIRED') && controller.includes('Search query is required.'));
check('search limit is capped safely', controller.includes('normalizeSearchLimit') && controller.includes('Math.min(50') && service.includes('normalizeLimit'));
check('search controller returns structured search failure', controller.includes('SEARCH_FAILED') && controller.includes('serverErrorResponse'));
check('search controller does not return raw error.message in 500 path', !controller.includes('res.status(500).json({ error: error.message })'));
check('project not found maps to 404 code', controller.includes("error?.code === 'PROJECT_NOT_FOUND'") && controller.includes("code: 'PROJECT_NOT_FOUND'"));
check('invalid object id maps to 400 code', controller.includes("error?.code === 'INVALID_OBJECT_ID'") && controller.includes("code: 'INVALID_OBJECT_ID'"));
check('semantic embedding generation can fail without failing whole search', service.includes('Failed to generate query embedding') && service.includes('queryEmbedding = []'));
check('vector candidate search can fail without failing keyword search', service.includes('Vector candidate search failed safely'));
check('search results normalize Dates to ISO strings', service.includes('toIsoString') && service.includes('createdAt: toIsoString') && service.includes('updatedAt: toIsoString'));
check('frontend command palette surfaces search errors', palette.includes('searchError') && palette.includes('Unable to search sources.'));
check('frontend command palette clears stale results on search failure', palette.includes('setResults([])') && palette.includes('setSearchError'));

if (failed) {
  console.log('\n[FAIL] Search error contract verification failed.');
  process.exit(1);
}

console.log('\n[PASS] Search error contract verification passed.');
