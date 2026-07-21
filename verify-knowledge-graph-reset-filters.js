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

console.log('\nKnowledge Graph Reset Filters verification');
console.log('==========================================');

const projectPage = read(projectPagePath);

console.log('\nTEST 1: Reset control');
assert('reset button label exists', projectPage.includes('Reset filters'));
assert('reset helper exists', projectPage.includes('resetRelationshipFilters'));
assert('reset button click is wired', projectPage.includes('onClick={resetRelationshipFilters}'));

console.log('\nTEST 2: Reset behavior');
assert('reset clears active relationship filter', projectPage.includes("setActiveRelationshipFilter('all')"));
assert('reset clears relationship search query', projectPage.includes("setRelationshipSearchQuery('')"));
assert('conditional reset state exists', projectPage.includes('hasActiveRelationshipFilters'));
assert('reset button is conditional', projectPage.includes('{hasActiveRelationshipFilters &&'));
assert('conditional checks filter or search state', projectPage.includes("activeRelationshipFilter !== 'all'") && projectPage.includes('relationshipSearchQuery.trim().length > 0'));

console.log('\nTEST 3: Existing controls remain');
assert('type filter state remains', projectPage.includes('activeRelationshipFilter'));
assert('search state remains', projectPage.includes('relationshipSearchQuery'));
assert('count badges remain', projectPage.includes('relationshipFilterCounts[filter.value]'));
assert('filter chips remain', projectPage.includes('RELATIONSHIP_FILTERS.map'));
assert('search placeholder remains', projectPage.includes('Search relationships...'));
assert('Dependency Graph remains untouched', projectPage.includes('Dependency Graph') && projectPage.includes('nodes={graphNodes}') && projectPage.includes('edges={graphEdges}'));

console.log('\nTEST 4: Build');
run('frontend build passes', 'npm run build', FRONTEND);

console.log('\nRESULTS');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) process.exit(1);
process.exit(0);
