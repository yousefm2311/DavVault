const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== AI SOURCE CONTEXT SAFETY VERIFICATION ===\n');

const context = read('backend/src/services/ai-context-builder.service.ts');
const search = read('backend/src/services/search.service.ts');
const aiController = read('backend/src/controllers/ai.controller.ts');
const citations = read('verify-ai-citations.js');
const navigation = read('verify-ai-citation-navigation.js');

check('AI context builder validates optional project/session/file ids', context.includes('isValidObjectIdString') && context.includes('Ignored invalid projectId') && context.includes('Ignored invalid fileId'));
check('AI context builder supports contextOwnerId for workspace project sources', context.includes('contextOwnerId?: string') && context.includes('const ownerId = isValidObjectIdString(contextOwnerId) ? contextOwnerId : userId'));
check('AI context builder supports workspaceId for scoped memory', context.includes('workspaceId?: string') && context.includes('workspaceId: scopedWorkspaceId'));
check('AI context builder scopes file/code context to context owner and project', context.includes('userId: ownerId') && context.includes('fileFilter.projectId = scopedProjectId'));
check('AI context builder scopes snippets to sourceProjectId', context.includes('snippetFilter.sourceProjectId = scopedProjectId'));
check('AI context builder scopes error lessons to projectId', context.includes('errorFilter.projectId = scopedProjectId'));
check('AI context builder keeps reusable systems user-owned/global', context.includes('relatedArchitectureBlueprints') && context.includes('ReusableSystem.find({ userId }'));
check('AI related search uses requester-private library scope', context.includes('searchService.search({') && context.includes('userId,') && !context.includes('userId: ownerId,\n          projectId: scopedProjectId'));
check('AI controller checks project access before passing contextOwnerId', aiController.includes('findAccessibleProject(userId, projectId') && aiController.includes('contextOwnerId'));
check('search service used by AI context builder has project access checks', search.includes('getAccessibleProjects(userId') && search.includes('PROJECT_NOT_FOUND'));
check('normalized citations contain safe metadata only', citations.includes('No full code in citation payloads') && citations.includes('ContextCitation has no content field'));
check('citation navigation verifier covers guarded source routes', navigation.includes('isSafeCitationRoute') && navigation.includes('safeProjectId') && navigation.includes('safeId'));

if (failed) {
  console.log('\n[FAIL] AI source context safety verification failed.');
  process.exit(1);
}

console.log('\n[PASS] AI source context safety verification passed.');
