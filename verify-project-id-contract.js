const fs = require('fs');
const path = require('path');
const mongoose = require(path.join(__dirname, 'backend/node_modules/mongoose'));

console.log('=== DEVVAULT AI: PROJECT ID CONTRACT VERIFICATION ===\n');

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

console.log('--- Backend project ID contract ---');

check(
  'Project controller validates ObjectId strings with mongoose',
  projectController.includes('mongoose.Types.ObjectId.isValid(value)')
);

check(
  'Invalid project ids return safe 400 responses before Mongoose project queries',
  projectController.includes('return invalidIdResponse(res, \'projectId\')') &&
    projectController.includes('code: \'INVALID_OBJECT_ID\'')
);

check(
  'Missing projects return safe 404 responses',
  (projectController.match(/Project not found\./g) || []).length >= 7
);

check(
  'Project upload returns projectId string',
  projectController.includes('projectId: newProject._id.toString()')
);

check(
  'Project route params are scoped consistently',
  projectRoutes.includes("router.get('/:id', authenticate, getProjectById)") &&
    projectRoutes.includes("router.delete('/:id', authenticate, deleteProject)") &&
    projectRoutes.includes("router.get('/:projectId/files/:fileId', authenticate, getFileContent)")
);

check(
  'File content endpoint validates both projectId and fileId',
  projectController.includes('isValidObjectId(projectId)') &&
    projectController.includes('isValidObjectId(fileId)')
);

check(
  'Project-scoped queries use access filter or owner filter',
  projectController.includes('accessibleProjectFilter(req.user.id') &&
    projectController.includes('Project.findOneAndDelete({ _id: id, userId: req.user.id })')
);

console.log('\n--- Serialization contract ---');

check(
  'Domain mapper detects ObjectIds before cloning objects',
  domainMapper.indexOf('normalizeObjectIdLike(obj)') > -1 &&
    domainMapper.indexOf('normalizeObjectIdLike(obj)') < domainMapper.indexOf('plain = { ...obj }')
);

check(
  'Domain mapper serializes Date and Buffer values safely',
  domainMapper.includes('obj.toISOString()') && domainMapper.includes('obj.toString(\'base64\')')
);

const distMapperPath = path.join(__dirname, 'backend/dist/utils/domain-mapper.js');
if (!fs.existsSync(distMapperPath)) {
  failed = true;
  console.log('[FAIL] Compiled domain mapper exists. Run backend build before this verifier.');
} else {
  const { decorateObject } = require(distMapperPath);
  const objectId = new mongoose.Types.ObjectId('6a3a4623cd2a85581f97d7a5');
  const date = new Date('2026-07-02T10:20:30.000Z');

  const output = decorateObject({
    _id: objectId,
    userId: objectId,
    createdAt: date,
    payload: Buffer.from('stable'),
    files: [{ _id: objectId, path: 'src/index.ts', extension: 'ts', size: 12 }]
  });

  check('ObjectIds serialize as hex strings', output._id === objectId.toHexString() && output.userId === objectId.toHexString());
  check('Dates serialize as ISO strings', output.createdAt === date.toISOString());
  check('Buffers do not leak as expanded objects', typeof output.payload === 'string' && output.payload === Buffer.from('stable').toString('base64'));
  check('Nested arrays keep ObjectId string serialization', output.files[0]._id === objectId.toHexString() && output.files[0].domainType === 'source_asset');
}

console.log('\n--- Frontend project ID contract ---');

check(
  'Project list keeps temporary legacy ID compatibility code marked',
  projectListPage.includes('Temporary compatibility for legacy responses') &&
    projectListPage.includes('const normalizeProjectId = (value: unknown): string')
);

check(
  'Project list normalizes ids before route navigation',
  projectListPage.includes('const projectId = normalizeProjectId(p._id)') &&
    projectListPage.includes('router.push(`/projects/${projectId}`)')
);

check(
  'Project list normalizes ids before delete calls',
  projectListPage.includes('handleDeleteProject(e, projectId)') &&
    projectListPage.includes('normalizeProjectId(p._id) !== id')
);

check(
  'Project list normalizes upload projectId before socket state',
  projectListPage.includes('projectId: normalizeProjectId(data.projectId)')
);

check(
  'Project details validates route id before API calls',
  projectDetailsPage.includes('isValidObjectIdString(id)') &&
    projectDetailsPage.indexOf('if (!isValidObjectIdString(id))') < projectDetailsPage.indexOf('Promise.all([')
);

check(
  'Project details validates file id before file API calls',
  projectDetailsPage.includes('!isValidObjectIdString(file?._id)') &&
    projectDetailsPage.includes('Unable to load this file.')
);

check(
  'Project details handles missing/deleted project without null crash',
  projectDetailsPage.includes('if (projectError || !project)') &&
    projectDetailsPage.includes('project?.name || \'project\'')
);

if (failed) {
  console.log('\n[FAIL] Project ID contract verification failed.');
  process.exit(1);
}

console.log('\n[PASS] Project ID contract verification passed.');
