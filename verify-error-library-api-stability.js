const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== ERROR LIBRARY API STABILITY VERIFICATION ===\n');

const controller = read('backend/src/controllers/error.controller.ts');
const routes = read('backend/src/routes/error.routes.ts');
const page = read('frontend/src/app/errors/page.tsx');

check('error library CRUD routes exist', ["router.post('/'", "router.get('/'", "router.get('/:id'", "router.delete('/:id'"].every((needle) => routes.includes(needle)));
check('error controller validates error ids', controller.includes("invalidIdResponse(res, 'errorId')") && controller.includes('isValidObjectIdString(req.params.id)'));
check('error controller validates projectId before project lookup', controller.includes("invalidIdResponse(res, 'projectId')") && controller.includes('isValidObjectIdString(projectId)'));
check('missing error lessons return safe 404 code', controller.includes('ERROR_LESSON_NOT_FOUND'));
check('missing projects return safe 404 code', controller.includes('PROJECT_NOT_FOUND') && controller.includes('Project not found.'));
check('error library 500 paths are structured', controller.includes('serverErrorResponse') && controller.includes('ERROR_LIBRARY_CREATE_FAILED') && controller.includes('ERROR_LIBRARY_LIST_FAILED'));
check('error controller avoids raw error.message 500 responses', !controller.includes('res.status(500).json({ error: error.message })'));
check('error embedding input is bounded', controller.includes('buildErrorEmbeddingText') && controller.includes('slice(0, 5000)'));
check('error embedding failure does not fail save response', controller.includes('Embedding indexing failed safely') && controller.includes('return res.status(201).json'));
check('error list supports project/tag filters without shape changes', controller.includes('filter.projectId = projectId') && controller.includes('filter.tags'));
check('frontend error page has load/save/delete error state', page.includes('errorsError') && page.includes('Unable to load error library.') && page.includes('Unable to save error lesson.') && page.includes('Unable to delete error lesson.'));
check('frontend error filtering handles missing fields', page.includes("String(e.title || '')") && page.includes("String(e.errorMessage || '')"));

if (failed) {
  console.log('\n[FAIL] Error library API stability verification failed.');
  process.exit(1);
}

console.log('\n[PASS] Error library API stability verification passed.');
