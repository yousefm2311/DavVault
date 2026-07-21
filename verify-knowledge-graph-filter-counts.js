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

console.log('\nKnowledge Graph Filter Counts verification');
console.log('==========================================');

const projectPage = read(projectPagePath);

console.log('\nTEST 1: Client-side count calculation');
assert('relationshipFilterCounts memo exists', projectPage.includes('relationshipFilterCounts'));
assert('counts are calculated from knowledgeRelationships', projectPage.includes('knowledgeRelationships.forEach'));
assert('All count uses total relationships', projectPage.includes('all: knowledgeRelationships.length'));
assert('missing relationshipType skipped for per-type counts', projectPage.includes('if (!relationship.relationshipType) return'));
assert('per-type counts increment relationshipType', projectPage.includes('counts[relationship.relationshipType]'));

console.log('\nTEST 2: Counts rendered on chips');
assert('filter count badge is rendered', projectPage.includes('relationshipFilterCounts[filter.value]'));
assert('zero counts are hidden', projectPage.includes('relationshipFilterCounts[filter.value] > 0'));
assert('count appears beside filter label', projectPage.includes('<span>{filter.label}</span>') && projectPage.includes('{relationshipFilterCounts[filter.value]}'));
assert('active filter count badge remains styled', projectPage.includes("activeRelationshipFilter === filter.value") && projectPage.includes('bg-success/20'));

console.log('\nTEST 3: No extra API call added');
const graphApiMatches = projectPage.match(/knowledge-graph\/neighborhood/g) || [];
assert('only existing neighborhood API reference remains', graphApiMatches.length === 1);
assert('entity relationship API remains unchanged', projectPage.includes('/knowledge-graph/entity/'));

console.log('\nTEST 4: Existing filter behavior remains');
assert('active filter state remains', projectPage.includes('activeRelationshipFilter'));
assert('filter helper remains', projectPage.includes('filterRelationshipsByType'));
assert('type-filtered relationships still exist', projectPage.includes('filteredKnowledgeRelationships'));
assert('graph uses searched relationships after filtering', projectPage.includes('searchedKnowledgeRelationships.forEach'));
assert('filtered empty state remains', projectPage.includes('No relationships found for this filter.'));
assert('Dependency Graph remains intact', projectPage.includes('Dependency Graph') && projectPage.includes('nodes={graphNodes}') && projectPage.includes('edges={graphEdges}'));

console.log('\nTEST 5: Build');
run('frontend build passes', 'npm run build', FRONTEND);

console.log('\nRESULTS');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) process.exit(1);
process.exit(0);
