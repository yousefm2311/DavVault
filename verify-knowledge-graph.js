'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`PASS: ${label}`);
    passed++;
  } else {
    console.error(`FAIL: ${label}`);
    failed++;
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function containsAll(content, values) {
  return values.every((value) => content.includes(value));
}

const ROOT = __dirname;
const BACKEND = path.join(ROOT, 'backend');
const SRC = path.join(BACKEND, 'src');
const DIST = path.join(BACKEND, 'dist');

console.log('\nKnowledge Graph verification');
console.log('================================');

console.log('\nTEST 1: Backend build');
try {
  execSync('npm run build', { cwd: BACKEND, stdio: 'pipe' });
  assert('backend build passes', true);
} catch (error) {
  assert('backend build passes', false);
  const stdout = error.stdout ? error.stdout.toString() : '';
  const stderr = error.stderr ? error.stderr.toString() : '';
  console.error(stdout || stderr || error.message);
}

const modelPath = path.join(SRC, 'models', 'KnowledgeRelationship.ts');
const servicePath = path.join(SRC, 'services', 'knowledge-graph.service.ts');
const routePath = path.join(SRC, 'routes', 'knowledge-graph.routes.ts');
const controllerPath = path.join(SRC, 'controllers', 'knowledge-graph.controller.ts');
const routesIndexPath = path.join(SRC, 'routes', 'index.ts');
const modelsIndexPath = path.join(SRC, 'models', 'index.ts');
const processorPath = path.join(SRC, 'services', 'project-processor.service.ts');
const contextPath = path.join(SRC, 'services', 'ai-context-builder.service.ts');
const packagePath = path.join(BACKEND, 'package.json');

console.log('\nTEST 2: Model exists and has required fields');
assert('KnowledgeRelationship model source exists', fileExists(modelPath));
assert('KnowledgeRelationship model dist exists', fileExists(path.join(DIST, 'models', 'KnowledgeRelationship.js')));

const modelSrc = fileExists(modelPath) ? read(modelPath) : '';
assert('models/index.ts exports KnowledgeRelationship', read(modelsIndexPath).includes("from './KnowledgeRelationship'"));
assert('model includes required node types', containsAll(modelSrc, [
  "'codebase'",
  "'source_asset'",
  "'logical_entity'",
  "'code_asset'",
  "'debugging_lesson'",
  "'architecture_blueprint'",
  "'memory'",
  "'chat_session'",
  "'activity'",
]));
assert('model includes required relationship types', containsAll(modelSrc, [
  "'contains'",
  "'defines'",
  "'imports'",
  "'calls'",
  "'depends_on'",
  "'related_to'",
]));
assert('model includes evidence object fields', containsAll(modelSrc, [
  'filePath',
  'sourceLine',
  'targetLine',
  'snippet',
  'reason',
]));
assert('model has active flag and timestamps', modelSrc.includes('isActive') && modelSrc.includes('timestamps: true'));
assert('model has requested indexes', containsAll(modelSrc, [
  'userId: 1, sourceType: 1, sourceId: 1',
  'userId: 1, targetType: 1, targetId: 1',
  'projectId: 1, relationshipType: 1',
  'sourceType: 1, targetType: 1, relationshipType: 1',
  'isActive: 1',
]));

console.log('\nTEST 3: Service exists and has required safeguards');
assert('knowledge graph service source exists', fileExists(servicePath));
assert('knowledge graph service dist exists', fileExists(path.join(DIST, 'services', 'knowledge-graph.service.js')));

const serviceSrc = fileExists(servicePath) ? read(servicePath) : '';
assert('service exports singleton', serviceSrc.includes('export const knowledgeGraphService'));
assert('service has required methods', containsAll(serviceSrc, [
  'createRelationship',
  'createRelationships',
  'findOutgoing',
  'findIncoming',
  'findNeighborhood',
  'deactivateRelationshipsForProject',
  'buildRelationshipsForProject',
]));
assert('dedupe key logic exists', serviceSrc.includes('$setOnInsert') && serviceSrc.includes('relationshipType'));
assert('model unique dedupe index exists', modelSrc.includes('unique: true'));
assert('depth is capped at max 2', serviceSrc.includes('MAX_DEPTH') && serviceSrc.includes('= 2') && serviceSrc.includes('Math.min(Math.max(depth, 1), MAX_DEPTH)'));
assert('reads filter inactive relationships', serviceSrc.includes('isActive:  true') || serviceSrc.includes('isActive: true'));
assert('project graph build catches failures', serviceSrc.includes('buildRelationshipsForProject failed safely'));
assert('service creates contains/defines/imports/calls/depends_on/exports edges', containsAll(serviceSrc, [
  "relationshipType: 'contains'",
  "relationshipType: 'defines'",
  "relationshipType: 'imports'",
  "relationshipType: 'calls'",
  "relationshipType: 'depends_on'",
  "relationshipType: 'exports'",
]));

console.log('\nTEST 4: Routes and controller');
assert('knowledge graph routes source exists', fileExists(routePath));
assert('knowledge graph controller source exists', fileExists(controllerPath));
assert('knowledge graph routes dist exists', fileExists(path.join(DIST, 'routes', 'knowledge-graph.routes.js')));

const routeSrc = fileExists(routePath) ? read(routePath) : '';
const controllerSrc = fileExists(controllerPath) ? read(controllerPath) : '';
const routesIndexSrc = read(routesIndexPath);
assert('routes are mounted', routesIndexSrc.includes('knowledgeGraphRoutes') && routesIndexSrc.includes("'/knowledge-graph'"));
assert('GET neighborhood route exists', routeSrc.includes("router.get('/neighborhood'"));
assert('GET entity relationships route exists', routeSrc.includes("router.get('/entity/:entityType/:entityId/relationships'"));
assert('routes require authentication', routeSrc.includes('authenticate'));
assert('controller uses req.user.id for isolation', controllerSrc.includes('req.user.id'));
assert('controller supports relationshipTypes query', controllerSrc.includes('relationshipTypes'));

console.log('\nTEST 5: Project processing integration');
const processorSrc = read(processorPath);
assert('project processor imports knowledge graph service', processorSrc.includes('knowledgeGraphService'));
assert('project processor calls buildRelationshipsForProject', processorSrc.includes('buildRelationshipsForProject(projectId)'));
assert('graph failure does not break processing', processorSrc.includes('.catch') && processorSrc.includes('Knowledge graph build failed safely'));
assert('parser metadata is persisted for graph builder', processorSrc.includes('metadata') && processorSrc.includes('exported') && processorSrc.includes('routeMethod'));

console.log('\nTEST 6: AI context integration');
const contextSrc = read(contextPath);
assert('context builder imports knowledge graph service', contextSrc.includes('knowledgeGraphService'));
assert('AiContext has relatedRelationships field', contextSrc.includes('relatedRelationships'));
assert('AI_CONTEXT_MAX_RELATIONSHIPS env var supported', contextSrc.includes('AI_CONTEXT_MAX_RELATIONSHIPS'));
assert('context builder fetches direct graph relationships', contextSrc.includes('findNeighborhood') && contextSrc.includes('depth:      1'));
assert('context builder continues when graph fails', contextSrc.includes('Graph relationship warning'));

console.log('\nTEST 7: No prohibited infrastructure dependencies');
const pkg = JSON.parse(read(packagePath));
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
assert('no qdrant dependency', !deps.qdrant && !deps['@qdrant/js-client-rest']);
assert('no neo4j dependency', !deps['neo4j-driver']);
assert('no S3 SDK dependency', !deps['aws-sdk'] && !deps['@aws-sdk/client-s3']);
assert('no Kafka dependency', !deps.kafka && !deps['kafka-node'] && !deps.kafkajs);
assert('knowledge graph files do not import prohibited infrastructure', !/(qdrant|neo4j|aws-sdk|@aws-sdk|kafkajs|kafka-node)/i.test([
  serviceSrc,
  modelSrc,
  routeSrc,
  controllerSrc,
].join('\n')));

console.log('\nRESULTS');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}

process.exit(0);
