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

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function run(label, cmd, cwd) {
  try {
    execSync(cmd, { cwd, stdio: 'pipe' });
    assert(label, true);
  } catch (error) {
    assert(label, false);
    const stdout = error.stdout ? error.stdout.toString() : '';
    const stderr = error.stderr ? error.stderr.toString() : '';
    console.error(stdout || stderr || error.message);
  }
}

const ROOT = __dirname;
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');
const controllerPath = path.join(BACKEND, 'src', 'controllers', 'knowledge-graph.controller.ts');
const projectPagePath = path.join(FRONTEND, 'src', 'app', 'projects', '[id]', 'page.tsx');
const chatPagePath = path.join(FRONTEND, 'src', 'app', 'chat', 'page.tsx');
const backendPackagePath = path.join(BACKEND, 'package.json');
const frontendPackagePath = path.join(FRONTEND, 'package.json');

console.log('\nKnowledge Graph Labels verification');
console.log('===================================');

const controller = read(controllerPath);
const projectPage = read(projectPagePath);
const chatPage = read(chatPagePath);

console.log('\nTEST 1: Backend display enrichment');
assert('controller has display resolver', controller.includes('resolveNodeDisplay'));
assert('controller enriches relationships', controller.includes('enrichRelationships'));
assert('display fields are returned', [
  'displayName',
  'displayType',
  'displaySubtitle',
  'sourceDisplayName',
  'targetDisplayName',
  'sourcePath',
  'targetPath',
].every((field) => controller.includes(field)));
assert('resolver handles projects/codebases', controller.includes("case 'codebase'") && controller.includes('Project.findOne'));
assert('resolver handles source assets', controller.includes("case 'source_asset'") && controller.includes('DBFile.findOne'));
assert('resolver handles logical entities', controller.includes("case 'logical_entity'") && controller.includes('CodeEntity.findById'));
assert('resolver handles snippets/errors/systems/memory/chat/activity', [
  'Snippet.findOne',
  'ErrorSolution.findOne',
  'ReusableSystem.findOne',
  'Memory.findOne',
  'ChatSession.findOne',
  'Activity.findOne',
].every((item) => controller.includes(item)));
assert('display resolution has safe fallback', controller.includes('fallbackNodeDisplay') && controller.includes('display resolution failed safely'));

console.log('\nTEST 2: Old graph fields preserved');
assert('sourceId remains in response path', controller.includes('sourceId'));
assert('targetId remains in response path', controller.includes('targetId'));
assert('sourceType remains in response path', controller.includes('sourceType'));
assert('targetType remains in response path', controller.includes('targetType'));
assert('incoming/outgoing response fields remain', controller.includes('outgoing') && controller.includes('incoming'));

console.log('\nTEST 3: Frontend display fallback');
assert('project graph interface includes display fields', projectPage.includes('sourceDisplayName') && projectPage.includes('targetDisplayName'));
assert('project graph uses display labels with fallback', projectPage.includes('relationship.sourceDisplayName') && projectPage.includes('relationship.targetDisplayName'));
assert('project graph falls back to IDs', projectPage.includes('entityId.slice') && projectPage.includes('counterpartId.slice'));
assert('chat uses display fields with fallback', chatPage.includes('targetDisplayName') && chatPage.includes('targetId.slice'));

console.log('\nTEST 4: Relationship labels humanized');
assert('project page humanizes relationship labels', projectPage.includes('humanizeRelationshipType'));
assert('chat page humanizes relationship labels', chatPage.includes('humanizeRelationshipType'));
assert('required relationship labels exist', [
  'Contains',
  'Defines',
  'Imports',
  'Calls',
  'Depends on',
  'Solves',
  'Documents',
  'Related to',
].every((label) => projectPage.includes(label) && chatPage.includes(label)));

console.log('\nTEST 5: No prohibited infrastructure dependencies');
const deps = {
  ...(JSON.parse(read(backendPackagePath)).dependencies || {}),
  ...(JSON.parse(read(backendPackagePath)).devDependencies || {}),
  ...(JSON.parse(read(frontendPackagePath)).dependencies || {}),
  ...(JSON.parse(read(frontendPackagePath)).devDependencies || {}),
};
assert('no qdrant dependency', !deps.qdrant && !deps['@qdrant/js-client-rest']);
assert('no neo4j dependency', !deps['neo4j-driver']);
assert('no S3 SDK dependency', !deps['aws-sdk'] && !deps['@aws-sdk/client-s3']);
assert('no Kafka/Event Bus dependency', !deps.kafka && !deps['kafka-node'] && !deps.kafkajs);

console.log('\nTEST 6: Builds');
run('backend build passes', 'npm run build', BACKEND);
run('frontend build passes', 'npm run build', FRONTEND);

console.log('\nRESULTS');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) process.exit(1);
process.exit(0);
