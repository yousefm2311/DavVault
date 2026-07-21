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

console.log('\nKnowledge Graph Relationship Search verification');
console.log('================================================');

const projectPage = read(projectPagePath);

console.log('\nTEST 1: Search input');
assert('search input state exists', projectPage.includes('relationshipSearchQuery'));
assert('search input placeholder exists', projectPage.includes('Search relationships...'));
assert('search input setter exists', projectPage.includes('setRelationshipSearchQuery'));
assert('search trims and lowercases query', projectPage.includes('relationshipSearchQuery.trim().toLowerCase()'));

console.log('\nTEST 2: Search fields');
[
  'sourceDisplayName',
  'targetDisplayName',
  'displayName',
  'sourcePath',
  'targetPath',
  'relationshipType',
  'evidence?.reason',
  'evidence?.snippet',
  'displaySubtitle',
  'sourceDisplaySubtitle',
  'targetDisplaySubtitle',
].forEach((field) => {
  assert(`search checks ${field}`, projectPage.includes(field));
});
assert('search handles missing fields safely', projectPage.includes('.filter(Boolean)'));
assert('search is case-insensitive', projectPage.includes('.toLowerCase()'));

console.log('\nTEST 3: Combined search and type filter');
assert('type filter result exists', projectPage.includes('filteredKnowledgeRelationships'));
assert('search runs over type-filtered relationships', projectPage.includes('return filteredKnowledgeRelationships.filter'));
assert('graph uses searched relationships', projectPage.includes('searchedKnowledgeRelationships.forEach'));
assert('clearing search restores filtered view', projectPage.includes('if (!relationshipSearchTerm) return filteredKnowledgeRelationships'));

console.log('\nTEST 4: Empty states and counts');
assert('search empty state exists', projectPage.includes('No relationships match your search.'));
assert('filter empty state remains', projectPage.includes('No relationships found for this filter.'));
assert('counts remain based on total fetched data', projectPage.includes('all: knowledgeRelationships.length') && projectPage.includes('knowledgeRelationships.forEach'));
assert('counts do not depend on search results', !projectPage.includes('searchedKnowledgeRelationships.forEach((relationship) => {\n      if (!relationship.relationshipType) return;\n      counts'));

console.log('\nTEST 5: Existing graph behavior remains');
assert('filter chips remain', projectPage.includes('RELATIONSHIP_FILTERS.map'));
assert('Dependency Graph remains intact', projectPage.includes('Dependency Graph') && projectPage.includes('nodes={graphNodes}') && projectPage.includes('edges={graphEdges}'));
assert('knowledge API call count unchanged', (projectPage.match(/knowledge-graph\/neighborhood/g) || []).length === 1);

console.log('\nTEST 6: Build');
run('frontend build passes', 'npm run build', FRONTEND);

console.log('\nRESULTS');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) process.exit(1);
process.exit(0);
