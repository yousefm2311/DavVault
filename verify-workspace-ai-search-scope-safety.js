const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== WORKSPACE AI/SEARCH SCOPE SAFETY VERIFICATION ===\n');

const searchService = read('backend/src/services/search.service.ts');
const aiController = read('backend/src/controllers/ai.controller.ts');
const contextBuilder = read('backend/src/services/ai-context-builder.service.ts');
const memory = read('backend/src/controllers/memory.controller.ts');
const graph = read('backend/src/controllers/knowledge-graph.controller.ts');

check('search service limits keyword and vector search to accessible projects', searchService.includes('accessibleProjectIds') && searchService.includes('projectId: { $in: accessibleProjectIds }'));
check('AI controller validates project access before context build', aiController.includes('findAccessibleProject') && aiController.includes('PROJECT_NOT_FOUND'));
check('AI context builder accepts contextOwnerId for workspace-owned files', contextBuilder.includes('contextOwnerId') && contextBuilder.includes('ownerId = isValidObjectIdString(contextOwnerId) ? contextOwnerId : userId'));
check('AI context builder accepts workspaceId for workspace memory', contextBuilder.includes('workspaceId?: string') && contextBuilder.includes('workspaceId: scopedWorkspaceId'));
check('AI related search uses requester scope for private libraries', contextBuilder.includes('searchService.search({') && contextBuilder.includes('userId,') && !contextBuilder.includes('userId: ownerId,\n          projectId: scopedProjectId'));
check('memory project/workspace scopes validate access', memory.includes('findAccessibleProject(req.user.id, projectId') && memory.includes('canAccessWorkspace'));
check('knowledge graph controller uses user-scoped display resolution', graph.includes('resolveNodeDisplay') && graph.includes('userId'));
check('raw CastError paths are avoided in memory controller', memory.includes('INVALID_OBJECT_ID') && !memory.includes('error.message'));

if (failed) process.exit(1);
console.log('\n[PASS] Workspace AI/search scope safety verification passed.');
