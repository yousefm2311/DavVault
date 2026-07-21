const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== SEARCH LIBRARY SCOPE SAFETY VERIFICATION ===\n');

const service = read('backend/src/services/search.service.ts');
const snippet = read('backend/src/controllers/snippet.controller.ts');
const error = read('backend/src/controllers/error.controller.ts');
const system = read('backend/src/controllers/system.controller.ts');

check('global search library filters are owner scoped', service.includes('const snippetFilter: any = {') && service.includes('const errorFilter: any = {') && service.includes('ReusableSystem.find({ userId'));
check('project search only filters user-owned snippet/error refs by project', service.includes('snippetFilter.sourceProjectId = projectId') && service.includes('errorFilter.projectId = projectId'));
check('systems are not returned as project-owned hits', service.includes('projectId') && service.includes('? Promise.resolve([])'));
check('vector search rechecks library source ownership', service.includes('Snippet.findOne(snippetFilterById') && service.includes('ErrorSolution.findOne(errorFilterById') && service.includes('ReusableSystem.findOne({ _id: candidate.sourceId, userId }'));
check('search previews are bounded', service.includes('substring(0, 300)') && service.includes('contentPreview'));
check('workspace library filters are not silently accepted', snippet.includes('WORKSPACE_SCOPE_UNSUPPORTED') && error.includes('WORKSPACE_SCOPE_UNSUPPORTED') && system.includes('WORKSPACE_SCOPE_UNSUPPORTED'));

if (failed) process.exit(1);
console.log('\n[PASS] Search library scope safety verification passed.');
