const fs = require('fs');
const path = require('path');

console.log('=== DEVVAULT AI: PROJECT API STABILITY VERIFICATION ===\n');

let failed = false;

const read = (relativePath) => {
  const fullPath = path.join(__dirname, relativePath);
  if (!fs.existsSync(fullPath)) {
    failed = true;
    console.log(`[FAIL] ${relativePath} exists`);
    return '';
  }
  return fs.readFileSync(fullPath, 'utf8');
};

const check = (name, condition) => {
  if (condition) {
    console.log(`[PASS] ${name}`);
  } else {
    failed = true;
    console.log(`[FAIL] ${name}`);
  }
};

const projectController = read('backend/src/controllers/project.controller.ts');
const projectRoutes = read('backend/src/routes/project.routes.ts');
const projectListPage = read('frontend/src/app/projects/page.tsx');
const projectDetailsPage = read('frontend/src/app/projects/[id]/page.tsx');
const domainMapper = read('backend/src/utils/domain-mapper.ts');
const indexSource = read('backend/src/index.ts');
const processorService = read('backend/src/services/project-processor.service.ts');
const queueService = read('backend/src/services/queue.service.ts');
const aiExtensionsController = read('backend/src/controllers/ai-extensions.controller.ts');

console.log('--- Backend project route coverage ---');
[
  "router.post('/upload'",
  "router.get('/'",
  "router.get('/:id'",
  "router.delete('/:id'",
  "router.get('/:id/download'",
  "router.get('/:id/overview'",
  "router.get('/:id/files'",
  "router.get('/:projectId/files/:fileId'",
  "router.get('/:id/health'",
  "router.get('/:id/graph'"
].forEach((signature) => {
  check(`${signature} exists`, projectRoutes.includes(signature));
});

check(
  'No project update route currently exists',
  !/router\.(put|patch)\('\/:id/.test(projectRoutes)
);

console.log('\n--- Backend response safety ---');
check(
  'Project controller uses structured invalid ObjectId responses',
  projectController.includes('INVALID_OBJECT_ID') &&
    projectController.includes('invalidIdResponse')
);

check(
  'Project controller uses structured server error responses',
  projectController.includes('serverErrorResponse') &&
    projectController.includes('PROJECT_UPLOAD_FAILED') &&
    !projectController.includes('error.message')
);

check(
  'Upload response returns projectId as a string',
  projectController.includes('projectId: newProject._id.toString()')
);

check(
  'Global response decorator excludes error/auth/token/download responses',
  indexSource.includes('skipDecoration') &&
    indexSource.includes('res.statusCode >= 400') &&
    indexSource.includes("req.path.startsWith('/auth')") &&
    indexSource.includes('body.accessToken') &&
    indexSource.includes('body.token') &&
    indexSource.includes("req.path.endsWith('/download')")
);

check(
  'Domain decorator keeps JSON-safe ObjectId/Date/Buffer values',
  domainMapper.includes('normalizeObjectIdLike(obj)') &&
    domainMapper.includes('obj.toISOString()') &&
    domainMapper.includes('Buffer.isBuffer(obj)')
);

console.log('\n--- Backend projectId validation and ownership ---');
[
  'getProjectById',
  'deleteProject',
  'getProjectOverview',
  'getProjectFiles',
  'getFileContent',
  'getProjectHealth',
  'getProjectGraph',
  'downloadProjectZip'
].forEach((fnName) => {
  const fnIndex = projectController.indexOf(`export const ${fnName}`);
  const nextFnIndex = projectController.indexOf('export const ', fnIndex + 1);
  const body = fnIndex >= 0 ? projectController.slice(fnIndex, nextFnIndex >= 0 ? nextFnIndex : undefined) : '';

  check(`${fnName} exists`, Boolean(body));
  if (!body) return;

  if (fnName === 'getFileContent') {
    check(`${fnName} validates projectId`, body.includes("isValidObjectId(projectId)") && body.includes("invalidIdResponse(res, 'projectId')"));
    check(`${fnName} validates fileId`, body.includes("isValidObjectId(fileId)") && body.includes("invalidIdResponse(res, 'fileId')"));
  } else {
    check(`${fnName} validates project id`, body.includes("isValidObjectId(id)") && body.includes("invalidIdResponse(res, 'projectId')"));
  }

  const usesAccessibleProjectFilter = body.includes('accessibleProjectFilter(req.user.id');
  const usesOwnerDeleteFilter = fnName === 'deleteProject' && body.includes('Project.findOneAndDelete({ _id: id, userId: req.user.id })');
  check(`${fnName} enforces project access before scoped work`, usesAccessibleProjectFilter || usesOwnerDeleteFilter);
  check(`${fnName} has safe 404 path`, body.includes("Project not found."));
});

check(
  'Delete project enforces owner-only deletion',
  projectController.includes('Project.findOneAndDelete({ _id: id, userId: req.user.id })')
);

check(
  'Project processing service validates ids before Project writes',
  processorService.includes('mongoose.Types.ObjectId.isValid(projectId)') &&
    processorService.includes('mongoose.Types.ObjectId.isValid(userId)')
);

check(
  'Queue progress broadcast validates ids before Project writes and socket room emits',
  queueService.includes('mongoose.Types.ObjectId.isValid(projectId)') &&
    queueService.includes('Ignoring progress broadcast for invalid project id') &&
    queueService.includes('project_${projectId}')
);

check(
  'Project replay validates project id and enforces accessible project access',
  aiExtensionsController.includes('getProjectReplay') &&
    aiExtensionsController.includes('mongoose.Types.ObjectId.isValid(id)') &&
    aiExtensionsController.includes('INVALID_OBJECT_ID') &&
    aiExtensionsController.includes('accessibleProjectFilter(req.user.id, id)')
);

console.log('\n--- Frontend project flow stability ---');
check(
  'Project list has loading state',
  projectListPage.includes('loadingProjects') && projectListPage.includes('SectionSkeleton')
);

check(
  'Project list has empty state',
  projectListPage.includes('noProjectsImportedYet') && projectListPage.includes('noProjectsImportedDesc')
);

check(
  'Project list has error state',
  projectListPage.includes('projectListError') && projectListPage.includes('Unable to load projects.')
);

check(
  'Project create flow handles upload errors',
  projectListPage.includes('setUploadError(err.message || t(') && projectListPage.includes('errorUploadFailed')
);

check(
  'Project delete flow handles errors',
  projectListPage.includes('Unable to delete project.') && projectListPage.includes('setProjectListError')
);

check(
  'Project details has loading state',
  projectDetailsPage.includes('loadingProject') && projectDetailsPage.includes('AppPageSkeleton')
);

check(
  'Project details validates invalid route ids',
  projectDetailsPage.includes('isValidObjectIdString(id)') && projectDetailsPage.includes('Invalid project id.')
);

check(
  'Project details handles missing/deleted project',
  projectDetailsPage.includes('Unable to load this project.') && projectDetailsPage.includes('Back to projects')
);

check(
  'Project details handles file content errors',
  projectDetailsPage.includes('fileContentError') && projectDetailsPage.includes('Unable to load file content.')
);

check(
  'Project details isolates optional graph/replay/health failures',
  projectDetailsPage.includes('Promise.allSettled') &&
    projectDetailsPage.includes('Optional replay load failed') &&
    projectDetailsPage.includes('Optional dependency graph load failed') &&
    projectDetailsPage.includes('Optional health load failed')
);

if (failed) {
  console.log('\n[FAIL] Project API stability verification failed.');
  process.exit(1);
}

console.log('\n[PASS] Project API stability verification passed.');
