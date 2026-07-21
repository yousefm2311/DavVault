const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== TEAM ACCESS PROPAGATION VERIFICATION ===\n');

const access = read('backend/src/utils/access-control.ts');
const project = read('backend/src/controllers/project.controller.ts');
const search = read('backend/src/services/search.service.ts');
const ai = read('backend/src/controllers/ai.controller.ts');
const socket = read('backend/src/index.ts');
const notification = read('backend/src/controllers/notification.controller.ts');

check('shared project access includes workspace membership', access.includes("Workspace.find({ 'members.userId': userId }") && access.includes('workspaceId: { $in:'));
check('project detail/list paths use access filters', project.includes('accessibleProjectFilter') && project.includes("Workspace.find({ 'members.userId': userId }"));
check('search uses accessible project ids', search.includes('accessibleProjectIds') && search.includes('getAccessibleProjects(userId'));
check('AI chat/explain checks accessible project scope', ai.includes('findAccessibleProject') && ai.includes('contextOwnerId'));
check('socket joins use same accessible project filter', socket.includes('accessibleProjectFilter(socket.data.userId, normalizedProjectId)'));
check('notifications re-check project link access', notification.includes('findAccessibleProject(userId, projectId'));

if (failed) process.exit(1);
console.log('\n[PASS] Team access propagation verification passed.');
