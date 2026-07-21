const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== REUSABLE SYSTEM PROJECT SCOPE SAFETY VERIFICATION ===\n');

const controller = read('backend/src/controllers/system.controller.ts');
const service = read('backend/src/services/search.service.ts');
const palette = read('frontend/src/components/CommandPalette.tsx');

check('system projectId query is validated when present', controller.includes("invalidIdResponse(res, 'projectId')") && controller.includes('isValidObjectIdString(projectId)'));
check('system projectId query checks project access when present', controller.includes('findAccessibleProject(req.user.id, projectId') && controller.includes('PROJECT_NOT_FOUND'));
check('system list remains user-owned because templates are global', controller.includes('Reusable systems are global user-owned templates') && controller.includes('const filter: any = { userId: req.user.id }'));
check('search service excludes reusable systems from project-owned result sets', service.includes('projectId') && service.includes('? Promise.resolve([])') && service.includes('ReusableSystem.find'));
check('search service only resolves vector reusable systems without project filter', service.includes('!projectId && (candidate.sourceType ===') && service.includes('ReusableSystem.findOne({ _id: candidate.sourceId, userId }'));
check('command palette safely navigates reusable systems by id', palette.includes("result.type === 'reusableSystem'") && palette.includes('router.push(`/systems?id=${resultId}`)'));
check('command palette does not require projectId for reusable systems', palette.includes("if (isValidObjectIdString(resultId)) router.push(`/systems?id=${resultId}`)"));

if (failed) {
  console.log('\n[FAIL] Reusable system project scope safety verification failed.');
  process.exit(1);
}

console.log('\n[PASS] Reusable system project scope safety verification passed.');
