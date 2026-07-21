const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== WORKSPACE ACCESS CONTRACT VERIFICATION ===\n');

const access = read('backend/src/utils/access-control.ts');
const project = read('backend/src/controllers/project.controller.ts');
const ai = read('backend/src/controllers/ai.controller.ts');
const search = read('backend/src/services/search.service.ts');
const socket = read('backend/src/index.ts');
const memory = read('backend/src/controllers/memory.controller.ts');

check('shared access filter includes owned projects and workspace member projects', access.includes('{ userId }') && access.includes("Workspace.find({ 'members.userId': userId }") && access.includes('workspaceId: { $in:'));
check('project controller uses workspace-aware accessible project checks', project.includes('accessibleProjectFilter') && project.includes("Workspace.find({ 'members.userId': userId }"));
check('AI controller has workspace-aware project access filter', ai.includes("Workspace.find({ 'members.userId': userId }") && ai.includes('workspaceId: { $in:'));
check('search service uses shared accessible projects', search.includes('getAccessibleProjects(userId') && search.includes('accessibleProjectIds'));
check('socket room join uses workspace-aware access filter', socket.includes('accessibleProjectFilter(socket.data.userId, normalizedProjectId)'));
check('memory workspace/project scopes validate access', memory.includes('canAccessWorkspace') && memory.includes('findAccessibleProject(req.user.id, projectId'));
check('workspace access failures return safe 404/403 responses', memory.includes('WORKSPACE_NOT_FOUND') && project.includes("res.status(404).json({ error: 'Project not found.'"));

if (failed) process.exit(1);
console.log('\n[PASS] Workspace access contract verification passed.');
