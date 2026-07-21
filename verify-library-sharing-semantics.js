const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== LIBRARY SHARING SEMANTICS VERIFICATION ===\n');

const doc = read('docs/library-sharing-semantics.md');
const snippetModel = read('backend/src/models/Snippet.ts');
const errorModel = read('backend/src/models/ErrorSolution.ts');
const systemModel = read('backend/src/models/ReusableSystem.ts');
const snippet = read('backend/src/controllers/snippet.controller.ts');
const error = read('backend/src/controllers/error.controller.ts');
const system = read('backend/src/controllers/system.controller.ts');

check('scope semantics documentation exists', doc.includes('user-private') && doc.includes('Memory supports explicit scopes'));
check('snippets have no implicit workspace visibility field', snippetModel.includes('userId') && !snippetModel.includes('workspaceId') && !snippetModel.includes('visibility'));
check('error lessons have no implicit workspace visibility field', errorModel.includes('userId') && !errorModel.includes('workspaceId') && !errorModel.includes('visibility'));
check('reusable systems have no implicit workspace visibility field', systemModel.includes('userId') && !systemModel.includes('workspaceId') && !systemModel.includes('visibility'));
check('workspace filters are explicitly rejected for user-private libraries', [snippet, error, system].every((content) => content.includes('WORKSPACE_SCOPE_UNSUPPORTED')));
check('project-linked library filters validate project access where supported', snippet.includes('findAccessibleProject(req.user.id, projectId') && error.includes('findAccessibleProject(req.user.id, projectId') && system.includes('findAccessibleProject(req.user.id, projectId'));

if (failed) process.exit(1);
console.log('\n[PASS] Library sharing semantics verification passed.');
