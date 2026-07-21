const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== AI MEMORY/SOURCE SCOPE SAFETY VERIFICATION ===\n');

const context = read('backend/src/services/ai-context-builder.service.ts');
const ai = read('backend/src/controllers/ai.controller.ts');
const memory = read('backend/src/services/memory.service.ts');

check('AI controller passes workspaceId only after project access check', ai.includes("findAccessibleProject(userId, projectId, 'userId workspaceId'") && ai.includes('workspaceId: contextWorkspaceId'));
check('AI context builder accepts workspaceId and passes it to memory lookup', context.includes('workspaceId?: string') && context.includes('workspaceId: scopedWorkspaceId'));
check('AI related search runs as requester, not project owner', context.includes('searchService.search({') && context.includes('userId,') && !context.includes('userId: ownerId,\n          projectId: scopedProjectId'));
check('AI snippets/errors/systems remain requester-private', context.includes('Snippet.find(snippetFilter') && context.includes('ErrorSolution.find(errorFilter') && context.includes('ReusableSystem.find({ userId }'));
check('memory service can return user/project/workspace scoped memories', memory.includes("scope: 'user'") && memory.includes("scope: 'project'") && memory.includes("scope: 'workspace'"));
check('citations omit memory content and full code', context.includes('full code, prompt text, memory content') && !context.includes('content: memory.content'));
check('context retrieval warnings isolate failures', context.includes('Memory retrieval warning') && context.includes('Snippet retrieval warning') && context.includes('Debugging lesson retrieval warning'));

if (failed) process.exit(1);
console.log('\n[PASS] AI memory/source scope safety verification passed.');
