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
const projectPagePath = path.join(FRONTEND, 'src', 'app', 'projects', '[id]', 'page.tsx');
const frontendPackagePath = path.join(FRONTEND, 'package.json');

console.log('\nKnowledge Graph Filters verification');
console.log('====================================');

const projectPage = read(projectPagePath);

console.log('\nTEST 1: Filter labels exist');
[
  'All',
  'Contains',
  'Defines',
  'Imports',
  'Exports',
  'Calls',
  'Uses',
  'Depends on',
  'Extends',
  'Implements',
  'Similar to',
  'Solves',
  'Documents',
  'Related to',
].forEach((label) => {
  assert(`filter label exists: ${label}`, projectPage.includes(label));
});

console.log('\nTEST 2: Client-side filtering');
assert('active filter state exists', projectPage.includes('activeRelationshipFilter'));
assert('default filter is All', projectPage.includes("useState<string>('all')"));
assert('filter helper exists', projectPage.includes('filterRelationshipsByType'));
assert('filter uses already fetched knowledgeRelationships', projectPage.includes('filterRelationshipsByType(knowledgeRelationships)'));
assert('filtered graph elements are derived client-side', projectPage.includes('filteredKnowledgeRelationships') && projectPage.includes('searchedKnowledgeRelationships.forEach'));
assert('missing relationshipType only matches All', projectPage.includes("activeRelationshipFilter === 'all'") && projectPage.includes('relationship.relationshipType === activeRelationshipFilter'));

console.log('\nTEST 3: UI behavior');
assert('filter chips render from RELATIONSHIP_FILTERS', projectPage.includes('RELATIONSHIP_FILTERS.map'));
assert('filter chip click sets active filter', projectPage.includes('setActiveRelationshipFilter(filter.value)'));
assert('selected node panel applies same filter to incoming', projectPage.includes('filterRelationshipsByType(selectedEntityRelationships.incoming)'));
assert('selected node panel applies same filter to outgoing', projectPage.includes('filterRelationshipsByType(selectedEntityRelationships.outgoing)'));
assert('filtered empty state exists', projectPage.includes('No relationships found for this filter.'));

console.log('\nTEST 4: Dependency graph preserved');
assert('Dependency Graph label remains', projectPage.includes('Dependency Graph'));
assert('existing graph nodes still render', projectPage.includes('nodes={graphNodes}'));
assert('existing graph edges still render', projectPage.includes('edges={graphEdges}'));
assert('old project graph API remains', projectPage.includes('/projects/${id}/graph'));
assert('dependency view branch remains', projectPage.includes("graphView === 'dependency'"));

console.log('\nTEST 5: No prohibited infrastructure dependencies');
const pkg = JSON.parse(read(frontendPackagePath));
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
assert('no qdrant dependency', !deps.qdrant && !deps['@qdrant/js-client-rest']);
assert('no neo4j dependency', !deps['neo4j-driver']);
assert('no S3 SDK dependency', !deps['aws-sdk'] && !deps['@aws-sdk/client-s3']);
assert('no Kafka/Event Bus dependency', !deps.kafka && !deps['kafka-node'] && !deps.kafkajs);

console.log('\nTEST 6: Build');
run('frontend build passes', 'npm run build', FRONTEND);

console.log('\nRESULTS');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) process.exit(1);
process.exit(0);
