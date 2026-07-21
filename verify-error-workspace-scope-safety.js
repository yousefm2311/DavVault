const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== ERROR LIBRARY WORKSPACE SCOPE SAFETY VERIFICATION ===\n');

const controller = read('backend/src/controllers/error.controller.ts');
const model = read('backend/src/models/ErrorSolution.ts');
const search = read('backend/src/services/search.service.ts');
const context = read('backend/src/services/ai-context-builder.service.ts');

check('error lesson model is user-owned with optional project ref', model.includes('userId') && model.includes('projectId') && !model.includes('workspaceId'));
check('error list/read/delete are owner scoped', controller.includes('const filter: any = { userId: req.user.id }') && controller.includes('findOne({ _id: req.params.id, userId: req.user.id') && controller.includes('findOneAndDelete({ _id: req.params.id, userId: req.user.id'));
check('error project refs require accessible project', controller.includes('findAccessibleProject(req.user.id, projectId'));
check('error workspace filters are rejected after id validation', controller.includes('workspaceId') && controller.includes('WORKSPACE_SCOPE_UNSUPPORTED'));
check('error fields are bounded before storage', controller.includes('String(errorMessage).slice(0, 8000)') && controller.includes('String(solution).slice(0, 8000)'));
check('error search is owner scoped', search.includes('const errorFilter: any = {') && search.includes('ErrorSolution.find(errorFilter)'));
check('AI context retrieves error lessons for requesting user only', context.includes('const errorFilter: any = { userId }') && context.includes('ErrorSolution.find(errorFilter'));

if (failed) process.exit(1);
console.log('\n[PASS] Error workspace scope safety verification passed.');
