const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== SNIPPET API STABILITY VERIFICATION ===\n');

const controller = read('backend/src/controllers/snippet.controller.ts');
const routes = read('backend/src/routes/snippet.routes.ts');
const page = read('frontend/src/app/snippets/page.tsx');

check('snippet CRUD routes exist', ["router.post('/'", "router.get('/'", "router.get('/:id'", "router.delete('/:id'"].every((needle) => routes.includes(needle)));
check('snippet controller validates snippet ids', controller.includes("invalidIdResponse(res, 'snippetId')") && controller.includes('isValidObjectIdString(req.params.id)'));
check('snippet controller validates optional source ids', controller.includes("invalidIdResponse(res, 'sourceProjectId')") && controller.includes("invalidIdResponse(res, 'sourceFileId')"));
check('snippet missing records return safe 404 code', controller.includes('SNIPPET_NOT_FOUND'));
check('snippet 500 paths are structured', controller.includes('serverErrorResponse') && controller.includes('SNIPPET_CREATE_FAILED') && controller.includes('SNIPPET_LIST_FAILED'));
check('snippet controller avoids raw error.message 500 responses', !controller.includes('res.status(500).json({ error: error.message })'));
check('snippet embedding input is bounded', controller.includes('buildSnippetEmbeddingText') && controller.includes('code.slice(0, 15000)'));
check('snippet embedding failure does not fail save response', controller.includes('Embedding indexing failed safely') && controller.includes('return res.status(201).json'));
check('snippet list supports safe filters without shape changes', controller.includes('filter.sourceProjectId = projectId') && controller.includes('filter.language') && controller.includes('filter.tags'));
check('frontend snippet page has load/save/delete error state', page.includes('snippetsError') && page.includes('Unable to load snippets.') && page.includes('Unable to save snippet.') && page.includes('Unable to delete snippet.'));
check('frontend snippet filtering handles missing fields', page.includes("String(s.title || '')") && page.includes("String(s.language || '')"));
check('frontend snippet URL/delete ids are guarded', page.includes('isValidObjectIdString(urlId)') && page.includes('isValidObjectIdString(id)'));

if (failed) {
  console.log('\n[FAIL] Snippet API stability verification failed.');
  process.exit(1);
}

console.log('\n[PASS] Snippet API stability verification passed.');
