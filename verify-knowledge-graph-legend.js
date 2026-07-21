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

console.log('\nKnowledge Graph Legend verification');
console.log('===================================');

const projectPage = read(projectPagePath);

console.log('\nTEST 1: Legend exists');
assert('legend state exists', projectPage.includes('showKnowledgeLegend'));
assert('legend toggle label exists', projectPage.includes('Legend'));
assert('legend toggle is wired', projectPage.includes('setShowKnowledgeLegend'));
assert('legend is conditional/collapsed by default', projectPage.includes('{showKnowledgeLegend &&'));

console.log('\nTEST 2: Node type labels');
[
  'Codebase',
  'Source Asset',
  'Logical Entity',
  'Code Asset',
  'Debugging Lesson',
  'Architecture Blueprint',
  'Memory',
].forEach((label) => {
  assert(`node type label exists: ${label}`, projectPage.includes(label));
});

console.log('\nTEST 3: Relationship labels');
[
  'Contains',
  'Defines',
  'Imports',
  'Exports',
  'Calls',
  'Uses',
  'Depends on',
  'Similar to',
  'Solves',
  'Documents',
  'Related to',
].forEach((label) => {
  assert(`relationship label exists: ${label}`, projectPage.includes(label));
});

console.log('\nTEST 4: Legend explanations');
assert('confidence explanation exists', projectPage.includes('Confidence badge') && projectPage.includes('inferred the relationship'));
assert('evidence explanation exists', projectPage.includes('Evidence text/path') && projectPage.includes('reason, snippet, file path, or source line'));

console.log('\nTEST 5: Existing controls remain');
assert('filters remain', projectPage.includes('RELATIONSHIP_FILTERS.map'));
assert('search remains', projectPage.includes('Search relationships...') && projectPage.includes('relationshipSearchQuery'));
assert('reset remains', projectPage.includes('Reset filters') && projectPage.includes('resetRelationshipFilters'));
assert('counts remain', projectPage.includes('relationshipFilterCounts[filter.value]'));
assert('Dependency Graph remains untouched', projectPage.includes('Dependency Graph') && projectPage.includes('nodes={graphNodes}') && projectPage.includes('edges={graphEdges}'));

console.log('\nTEST 6: Build');
run('frontend build passes', 'npm run build', FRONTEND);

console.log('\nRESULTS');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) process.exit(1);
process.exit(0);
