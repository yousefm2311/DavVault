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
const FRONTEND = path.join(ROOT, 'frontend');
const BACKEND = path.join(ROOT, 'backend');
const projectPagePath = path.join(FRONTEND, 'src', 'app', 'projects', '[id]', 'page.tsx');
const chatPagePath = path.join(FRONTEND, 'src', 'app', 'chat', 'page.tsx');
const frontendPackagePath = path.join(FRONTEND, 'package.json');
const backendPackagePath = path.join(BACKEND, 'package.json');

console.log('\nKnowledge Graph UI verification');
console.log('================================');

const projectPage = read(projectPagePath);
const chatPage = read(chatPagePath);

console.log('\nTEST 1: Project details knowledge graph integration');
assert('project details references neighborhood API', projectPage.includes('/knowledge-graph/neighborhood?entityType=codebase'));
assert('project details references entity relationship API', projectPage.includes('/knowledge-graph/entity/'));
assert('graph toggle includes Dependency Graph label', projectPage.includes('Dependency Graph'));
assert('graph toggle includes Knowledge Relationships label', projectPage.includes('Knowledge Relationships'));
assert('knowledge graph has separate state from dependency graph', projectPage.includes('knowledgeRelationships') && projectPage.includes('graphNodes'));

console.log('\nTEST 2: Relationship panel behavior');
assert('relationship panel loader exists', projectPage.includes('loadingEntityRelationships'));
assert('incoming relationships section exists', projectPage.includes('Incoming relationships'));
assert('outgoing relationships section exists', projectPage.includes('Outgoing relationships'));
assert('relationship type is rendered', projectPage.includes('relationship.relationshipType'));
assert('confidence badge helper exists', projectPage.includes('formatConfidence'));
assert('evidence reason/filePath/sourceLine handling exists', projectPage.includes('evidence.reason') && projectPage.includes('evidence.filePath') && projectPage.includes('evidence.sourceLine'));

console.log('\nTEST 3: Safety and failure handling');
assert('knowledge graph loading state exists', projectPage.includes('loadingKnowledgeGraph'));
assert('knowledge graph error state exists', projectPage.includes('knowledgeGraphError'));
assert('API failure catch exists', projectPage.includes('Knowledge graph load failed') && projectPage.includes('Entity relationships load failed'));
assert('empty state exists for knowledge graph', projectPage.includes('No knowledge relationships found'));
assert('missing entity ID is handled safely', projectPage.includes('No relationship lookup available for this node'));

console.log('\nTEST 4: Existing dependency graph preserved');
assert('ReactFlow import remains present', projectPage.includes("from 'reactflow'"));
assert('old project graph API still loaded', projectPage.includes('/projects/${id}/graph'));
assert('dependency graph nodes still use graphNodes', projectPage.includes('nodes={graphNodes}'));
assert('dependency graph edges still use graphEdges', projectPage.includes('edges={graphEdges}'));
assert('dependency graph selected node panel remains', projectPage.includes('selectedGraphNode'));

console.log('\nTEST 5: AI context visibility');
assert('project page handles optional relatedRelationships', projectPage.includes('relatedRelationships') && projectPage.includes('Related Knowledge'));
assert('chat page handles optional relatedRelationships', chatPage.includes('relatedRelationships') && chatPage.includes('Related Knowledge'));
assert('chat response shape is not required to change', chatPage.includes('Array.isArray(data.relatedRelationships)'));

console.log('\nTEST 6: No prohibited infrastructure dependencies');
const frontendPkg = JSON.parse(read(frontendPackagePath));
const backendPkg = JSON.parse(read(backendPackagePath));
const deps = {
  ...(frontendPkg.dependencies || {}),
  ...(frontendPkg.devDependencies || {}),
  ...(backendPkg.dependencies || {}),
  ...(backendPkg.devDependencies || {}),
};
assert('no qdrant dependency', !deps.qdrant && !deps['@qdrant/js-client-rest']);
assert('no neo4j dependency', !deps['neo4j-driver']);
assert('no S3 SDK dependency', !deps['aws-sdk'] && !deps['@aws-sdk/client-s3']);
assert('no Kafka/Event Bus dependency', !deps.kafka && !deps['kafka-node'] && !deps.kafkajs);
assert('frontend code does not reference prohibited infrastructure', !/(qdrant|neo4j|aws-sdk|@aws-sdk|kafkajs|kafka-node|event bus|planner ai)/i.test(projectPage + chatPage));

console.log('\nTEST 7: Builds');
run('frontend build passes', 'npm run build', FRONTEND);
run('backend build passes', 'npm run build', BACKEND);

console.log('\nRESULTS');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) process.exit(1);
process.exit(0);
