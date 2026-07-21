const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== SEARCH PROJECT SCOPE SAFETY VERIFICATION ===\n');

const service = read('backend/src/services/search.service.ts');
const controller = read('backend/src/controllers/search.controller.ts');
const palette = read('frontend/src/components/CommandPalette.tsx');
const access = read('backend/src/utils/access-control.ts');

check('shared ObjectId string validation exists', access.includes('isValidObjectIdString') && access.includes('/^[a-fA-F0-9]{24}$/'));
check('search controller rejects invalid projectId before service call', controller.includes("Invalid projectId.") && controller.includes('INVALID_OBJECT_ID'));
check('search service rejects invalid projectId before Mongoose work', service.includes("throw searchError('Invalid projectId.'") && service.includes('isValidObjectIdString(projectId)'));
check('search service loads workspace-accessible projects', service.includes('getAccessibleProjects(userId') && access.includes("'members.userId'"));
check('missing or unauthorized projectId returns PROJECT_NOT_FOUND', service.includes("PROJECT_NOT_FOUND") && controller.includes("error?.code === 'PROJECT_NOT_FOUND'"));
check('file keyword search is limited to accessible project ids', service.includes('projectId: { $in: accessibleProjectIds }') && service.includes('DBFile.find({ ...projectFilter'));
check('code entity keyword search is limited to accessible project ids', service.includes('CodeEntity.find({ ...projectFilter'));
check('snippet project filter uses sourceProjectId', service.includes('snippetFilter.sourceProjectId = projectId'));
check('error lesson project filter uses projectId', service.includes('errorFilter.projectId = projectId'));
check('reusable systems are not returned as project-owned search hits', service.includes('projectId') && service.includes('? Promise.resolve([])') && service.includes('ReusableSystem.find'));
check('vector search uses project/access filter rather than raw user-only project assumptions', service.includes('const embeddingFilter') && service.includes("{ projectId }") && service.includes('projectId: { $in: accessibleProjectIds }'));
check('vector candidates are rechecked against accessible project ids', service.includes('candidateProjectId') && service.includes('!accessibleProjectIds.includes(candidateProjectId)'));
check('frontend command palette guards project/file routes', palette.includes('isValidObjectIdString(projectId)') && palette.includes('isValidObjectIdString(fileId)'));

if (failed) {
  console.log('\n[FAIL] Search project scope safety verification failed.');
  process.exit(1);
}

console.log('\n[PASS] Search project scope safety verification passed.');
