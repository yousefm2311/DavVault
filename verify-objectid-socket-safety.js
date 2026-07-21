const fs = require('fs');
const path = require('path');
const mongoose = require(path.join(__dirname, 'backend/node_modules/mongoose'));

console.log('=== DEVVAULT AI: OBJECTID SERIALIZATION & SOCKET SAFETY VERIFICATION ===\n');

let failed = false;

function pass(name) {
  console.log(`[PASS] ${name}`);
}

function fail(name, message) {
  console.log(`[FAIL] ${name}${message ? `: ${message}` : ''}`);
  failed = true;
}

function read(relativePath) {
  const fullPath = path.join(__dirname, relativePath);
  if (!fs.existsSync(fullPath)) {
    fail(`${relativePath} exists`, 'file not found');
    return '';
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function expect(name, condition, message) {
  if (condition) pass(name);
  else fail(name, message);
}

const domainMapperSource = read('backend/src/utils/domain-mapper.ts');
const backendIndexSource = read('backend/src/index.ts');
const projectsPageSource = read('frontend/src/app/projects/page.tsx');

console.log('--- Static checks ---');

expect(
  'decorateObject normalizes ObjectId-like values before cloning',
  domainMapperSource.includes('normalizeObjectIdLike(obj)') &&
    domainMapperSource.indexOf('normalizeObjectIdLike(obj)') < domainMapperSource.indexOf('plain = { ...obj }')
);

expect(
  'decorateObject keeps Date values ISO/string-safe',
  domainMapperSource.includes('obj instanceof Date') && domainMapperSource.includes('obj.toISOString()')
);

expect(
  'decorateObject handles Buffer values before object spreading',
  domainMapperSource.includes('Buffer.isBuffer(obj)') &&
    domainMapperSource.indexOf('Buffer.isBuffer(obj)') < domainMapperSource.indexOf('plain = { ...obj }')
);

expect(
  'decorateObject keeps array recursion intact',
  domainMapperSource.includes('Array.isArray(obj)') && domainMapperSource.includes('obj.map(item => decorateObject(item))')
);

expect(
  'decorateObject keeps Mongoose document serialization intact',
  domainMapperSource.includes("typeof obj.toObject === 'function'") &&
    domainMapperSource.includes('obj.toObject({ virtuals: true })')
);

expect(
  'Auth/token/error responses remain excluded from decoration',
  backendIndexSource.includes('skipDecoration') &&
    backendIndexSource.includes('res.statusCode >= 400') &&
    backendIndexSource.includes("req.path.startsWith('/auth')") &&
    backendIndexSource.includes('body.error') &&
    backendIndexSource.includes('body.accessToken') &&
    backendIndexSource.includes('body.token')
);

expect(
  'join_project only accepts valid ObjectId strings',
  backendIndexSource.includes('const normalizeSocketProjectId = (value: unknown): string | null') &&
    backendIndexSource.includes("typeof value === 'string'") &&
    backendIndexSource.includes('mongoose.Types.ObjectId.isValid(value)') &&
    !backendIndexSource.includes('socket.on(\'join_project\', async (projectId: string)')
);

expect(
  'Socket handlers reject invalid project IDs without throwing',
  backendIndexSource.includes('if (!normalizedProjectId)') &&
    backendIndexSource.includes('Ignoring invalid project room id') &&
    backendIndexSource.includes('try {') &&
    backendIndexSource.includes('catch (err)')
);

expect(
  'Socket room names are built from normalized safe strings',
  backendIndexSource.includes('socket.join(`project_${normalizedProjectId}`)') &&
    backendIndexSource.includes('socket.leave(`project_${normalizedProjectId}`)')
);

expect(
  'Socket join checks project ownership before joining room',
  backendIndexSource.includes('Project.findOne({ _id: normalizedProjectId, userId: socket.data.userId }') &&
    backendIndexSource.includes('if (!project) return;')
);

expect(
  'Frontend stores normalized activeJob projectId',
  projectsPageSource.includes('projectId: normalizeProjectId(processingProject._id)')
);

expect(
  'Frontend normalizes activeJob projectId before socket emit',
  projectsPageSource.includes('const projectId = normalizeProjectId(activeJob.projectId)') &&
    projectsPageSource.includes("socket.emit('join_project', projectId)")
);

expect(
  'Frontend skips socket join when projectId is missing or invalid',
  projectsPageSource.includes('if (!projectId) return;')
);

console.log('\n--- Programmatic decorateObject checks ---');

const distMapperPath = path.join(__dirname, 'backend/dist/utils/domain-mapper.js');
if (!fs.existsSync(distMapperPath)) {
  fail('Compiled domain mapper exists', 'run backend build before this verifier');
} else {
  const { decorateObject } = require(distMapperPath);
  const objectId = new mongoose.Types.ObjectId('6a3a4623cd2a85581f97d7a5');
  const date = new Date('2024-01-02T03:04:05.000Z');

  const objectIdOutput = decorateObject({
    _id: objectId,
    nested: { ownerId: objectId }
  });
  expect(
    'ObjectId values serialize to strings',
    objectIdOutput._id === objectId.toHexString() &&
      objectIdOutput.nested.ownerId === objectId.toHexString()
  );

  const objectIdBufferOutput = decorateObject({
    _id: {
      buffer: {
        '0': 106,
        '1': 58,
        '2': 70,
        '3': 35,
        '4': 205,
        '5': 42,
        '6': 133,
        '7': 88,
        '8': 31,
        '9': 151,
        '10': 215,
        '11': 165
      }
    }
  });
  expect('ObjectId-like buffer values serialize to strings', objectIdBufferOutput._id === '6a3a4623cd2a85581f97d7a5');

  const dateOutput = decorateObject({ createdAt: date });
  expect('Date values serialize to ISO strings', dateOutput.createdAt === date.toISOString());

  const bufferOutput = decorateObject({ payload: Buffer.from('abc') });
  expect(
    'Buffer values do not expand into numeric objects',
    typeof bufferOutput.payload === 'string' && bufferOutput.payload === Buffer.from('abc').toString('base64')
  );

  const arrayOutput = decorateObject({
    projects: [
      { _id: objectId, name: 'proj', userId: objectId, processingStatus: 'completed', healthScore: 95 }
    ]
  });
  expect(
    'Arrays still decorate safely',
    arrayOutput.projects[0]._id === objectId.toHexString() &&
      arrayOutput.projects[0].userId === objectId.toHexString() &&
      arrayOutput.projects[0].domainType === 'codebase'
  );

  const modelName = 'ObjectIdSocketSafetyProject';
  const ProjectModel =
    mongoose.models[modelName] ||
    mongoose.model(
      modelName,
      new mongoose.Schema({
        name: String,
        userId: mongoose.Schema.Types.ObjectId,
        processingStatus: String,
        healthScore: Number,
        createdAt: Date
      })
    );
  const doc = new ProjectModel({
    _id: objectId,
    name: 'doc-project',
    userId: objectId,
    processingStatus: 'completed',
    healthScore: 88,
    createdAt: date
  });
  const docOutput = decorateObject(doc);
  expect(
    'Mongoose documents serialize safely',
    docOutput._id === objectId.toHexString() &&
      docOutput.userId === objectId.toHexString() &&
      docOutput.createdAt === date.toISOString() &&
      docOutput.domainType === 'codebase'
  );
}

if (failed) {
  console.log('\n[FAIL] ObjectId/socket safety verification failed.');
  process.exit(1);
}

console.log('\n[PASS] ObjectId/socket safety verification passed.');
