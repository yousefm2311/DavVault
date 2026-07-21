const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== REUSABLE SYSTEM WORKSPACE SCOPE SAFETY VERIFICATION ===\n');

const controller = read('backend/src/controllers/system.controller.ts');
const model = read('backend/src/models/ReusableSystem.ts');
const search = read('backend/src/services/search.service.ts');
const context = read('backend/src/services/ai-context-builder.service.ts');

check('reusable system model is global user-owned template', model.includes('userId') && !model.includes('projectId') && !model.includes('workspaceId'));
check('system list/read/delete are owner scoped', controller.includes('const filter: any = { userId: req.user.id }') && controller.includes('findOne({ _id: req.params.id, userId: req.user.id') && controller.includes('findOneAndDelete({ _id: req.params.id, userId: req.user.id'));
check('project filter validates access but does not make systems project-owned', controller.includes('validate access to the project before returning the user') && controller.includes('findAccessibleProject(req.user.id, projectId'));
check('system workspace filters are rejected after id validation', controller.includes('workspaceId') && controller.includes('WORKSPACE_SCOPE_UNSUPPORTED'));
check('system fields are bounded before storage', controller.includes('String(description).slice(0, 4000)') && controller.includes('String(flow).slice(0, 12000)'));
check('system search is user-owned and skipped during project search', search.includes('? Promise.resolve([])') && search.includes('ReusableSystem.find({ userId'));
check('AI context retrieves systems for requesting user only', context.includes('ReusableSystem.find({ userId }'));

if (failed) process.exit(1);
console.log('\n[PASS] Reusable system workspace scope safety verification passed.');
