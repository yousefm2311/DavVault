const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== MEMORY SCOPE SAFETY VERIFICATION ===\n');

const controller = read('backend/src/controllers/memory.controller.ts');
const service = read('backend/src/services/memory.service.ts');
const model = read('backend/src/models/Memory.ts');

check('memory model has explicit user/project/workspace scopes', model.includes("enum: ['user', 'project', 'workspace']") && model.includes('workspaceId') && model.includes('projectId'));
check('memory list uses readable scope filter instead of owner-only filter', controller.includes('buildReadableMemoryFilter') && controller.includes("scope: 'project'") && controller.includes("scope: 'workspace'"));
check('project-scoped memory requires accessible project', controller.includes('findAccessibleProject(req.user.id, projectId') && controller.includes('PROJECT_NOT_FOUND'));
check('workspace-scoped memory requires workspace membership', controller.includes('canAccessWorkspace') && controller.includes('WORKSPACE_NOT_FOUND'));
check('memory read-by-id respects user/project/workspace scope', controller.includes("scope === 'user'") && controller.includes("scope === 'project'") && controller.includes("scope === 'workspace'"));
check('memory update/delete remain owner-only', controller.includes("{ _id: id, userId: new Types.ObjectId(req.user.id) }"));
check('AI memory retrieval supports scoped project/workspace memory', service.includes('scopeConditions.push({ projectId') && service.includes('scopeConditions.push({ workspaceId'));

if (failed) process.exit(1);
console.log('\n[PASS] Memory scope safety verification passed.');
