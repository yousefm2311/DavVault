const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== SNIPPET WORKSPACE SCOPE SAFETY VERIFICATION ===\n');

const controller = read('backend/src/controllers/snippet.controller.ts');
const model = read('backend/src/models/Snippet.ts');
const search = read('backend/src/services/search.service.ts');
const context = read('backend/src/services/ai-context-builder.service.ts');

check('snippet model is user-owned with optional project/file refs', model.includes('userId') && model.includes('sourceProjectId') && model.includes('sourceFileId'));
check('snippet list/read/delete are owner scoped', controller.includes('const filter: any = { userId: req.user.id }') && controller.includes('findOne({ _id: req.params.id, userId: req.user.id') && controller.includes('findOneAndDelete({ _id: req.params.id, userId: req.user.id'));
check('snippet project refs require accessible project/file', controller.includes('findAccessibleProject(req.user.id, sourceProjectId') && controller.includes('DBFile.findOne(fileFilter'));
check('snippet workspace filters are rejected after id validation', controller.includes('workspaceId') && controller.includes('WORKSPACE_SCOPE_UNSUPPORTED'));
check('snippet stored fields are bounded', controller.includes('String(code).slice(0, 50000)') && controller.includes('tags.slice(0, 20)'));
check('snippet embeddings/search are owner scoped', search.includes('const snippetFilter: any = {') && search.includes('userId,') && search.includes('Snippet.find(snippetFilter)'));
check('AI context retrieves snippets for requesting user only', context.includes('const snippetFilter: any = { userId }') && context.includes('Snippet.find(snippetFilter'));

if (failed) process.exit(1);
console.log('\n[PASS] Snippet workspace scope safety verification passed.');
