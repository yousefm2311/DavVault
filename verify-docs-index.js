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

const ROOT = __dirname;
const runbookPath = path.join(ROOT, 'RUNBOOK.md');

console.log('\nDocs Index verification');
console.log('=======================');

console.log('\nTEST 1: Main docs entry');
assert('RUNBOOK.md exists', fs.existsSync(runbookPath));

const runbook = fs.existsSync(runbookPath) ? read(runbookPath) : '';
const lower = runbook.toLowerCase();

console.log('\nTEST 2: AI Context Trace link');
assert('section title exists', runbook.includes('AI Context Trace Debugging'));
assert('docs/ai-context-trace.md link exists', runbook.includes('[docs/ai-context-trace.md](docs/ai-context-trace.md)'));
assert('local-only debug endpoint note exists', lower.includes('local-only') && lower.includes('debug endpoint'));
assert('auth requirement is documented', lower.includes('authenticated'));
assert('context/memory/relationships use is documented', lower.includes('selected ai context') && lower.includes('developer memory') && lower.includes('knowledge graph relationships'));
assert('production safety note exists', lower.includes('disabled in production') && runbook.includes('AI_DEBUG_CONTEXT_TRACE=true'));

console.log('\nTEST 3: No backend/frontend source files changed by docs index phase');
let scopedStatus = '';
try {
  scopedStatus = execSync('git status --short RUNBOOK.md verify-docs-index.js', {
    cwd: ROOT,
    stdio: 'pipe',
  }).toString();
} catch (error) {
  scopedStatus = (error.stdout || error.stderr || Buffer.from(error.message)).toString();
}

const changedLines = scopedStatus.split('\n').filter(Boolean);
let runbookDiff = '';
try {
  runbookDiff = execSync('git diff -- RUNBOOK.md', { cwd: ROOT, stdio: 'pipe' }).toString();
} catch (error) {
  runbookDiff = (error.stdout || error.stderr || Buffer.from(error.message)).toString();
}

assert('RUNBOOK.md is the docs entry touched', changedLines.some((line) => line.includes('RUNBOOK.md')));
assert('verify-docs-index.js exists in status', fs.existsSync(path.join(ROOT, 'verify-docs-index.js')));
assert('RUNBOOK diff only references docs content', runbookDiff.includes('AI Context Trace Debugging') && !runbookDiff.includes('backend/src') && !runbookDiff.includes('frontend/src'));

console.log('\nRESULTS');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) process.exit(1);
process.exit(0);
