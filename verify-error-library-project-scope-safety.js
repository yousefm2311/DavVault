const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== ERROR LIBRARY PROJECT SCOPE SAFETY VERIFICATION ===\n');

const controller = read('backend/src/controllers/error.controller.ts');
const service = read('backend/src/services/search.service.ts');
const page = read('frontend/src/app/errors/page.tsx');

check('create error lesson checks accessible project', controller.includes('findAccessibleProject(req.user.id, projectId') && controller.includes('PROJECT_NOT_FOUND'));
check('list error lessons checks accessible project before filtering', controller.includes('findAccessibleProject(req.user.id, projectId') && controller.includes('filter.projectId = projectId'));
check('error lesson read/delete remain user-owned', controller.includes('ErrorSolution.findOne({ _id: req.params.id, userId: req.user.id })') && controller.includes('ErrorSolution.findOneAndDelete({ _id: req.params.id, userId: req.user.id })'));
check('project invalid ids return 400 rather than Mongoose cast errors', controller.includes("invalidIdResponse(res, 'projectId')"));
check('old invalid project reference 400 behavior was removed', !controller.includes('Invalid project reference.'));
check('search service scopes project error results by projectId', service.includes('errorFilter.projectId = projectId'));
check('search service scopes vector error resolution by projectId', service.includes('errorFilterById.projectId = projectId'));
check('frontend related project dropdown uses fetched projects only', page.includes("apiFetch('/projects')") && page.includes('setProjects(projectsData.projects || [])'));
check('frontend error URL/delete ids are guarded', page.includes('isValidObjectIdString(urlId)') && page.includes('isValidObjectIdString(id)'));

if (failed) {
  console.log('\n[FAIL] Error library project scope safety verification failed.');
  process.exit(1);
}

console.log('\n[PASS] Error library project scope safety verification passed.');
