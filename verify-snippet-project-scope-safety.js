const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== SNIPPET PROJECT SCOPE SAFETY VERIFICATION ===\n');

const controller = read('backend/src/controllers/snippet.controller.ts');
const service = read('backend/src/services/search.service.ts');

check('snippet sourceProjectId requires accessible project lookup', controller.includes('findAccessibleProject(req.user.id, sourceProjectId') && controller.includes('PROJECT_NOT_FOUND'));
check('snippet sourceFileId is scoped to source project owner', controller.includes('projectOwnerId') && controller.includes('DBFile.findOne(fileFilter'));
check('snippet source file check binds file to sourceProjectId when present', controller.includes('if (sourceProjectId) fileFilter.projectId = sourceProjectId'));
check('snippet create stores project reference without destructive schema change', controller.includes('sourceProjectId,') && controller.includes('sourceFileId,'));
check('snippet embedding stores projectId for scoped search', controller.includes('projectId: sourceProjectId'));
check('snippet list with projectId validates project access before query', controller.includes('findAccessibleProject(req.user.id, projectId') && controller.includes('filter.sourceProjectId = projectId'));
check('snippet read/delete remain user-owned', controller.includes('Snippet.findOne({ _id: req.params.id, userId: req.user.id })') && controller.includes('Snippet.findOneAndDelete({ _id: req.params.id, userId: req.user.id })'));
check('search service scopes project search snippets by sourceProjectId', service.includes('snippetFilter.sourceProjectId = projectId'));
check('search service scopes vector snippet resolution by sourceProjectId', service.includes('snippetFilterById.sourceProjectId = projectId'));

if (failed) {
  console.log('\n[FAIL] Snippet project scope safety verification failed.');
  process.exit(1);
}

console.log('\n[PASS] Snippet project scope safety verification passed.');
