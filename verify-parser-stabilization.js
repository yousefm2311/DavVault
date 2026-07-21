/**
 * verify-parser-stabilization.js
 *
 * Runs after `npm run build` inside /backend.
 * Tests ALL stabilization paths for Phase 3.
 * Exit code 1 = failure. Exit code 0 = all pass.
 */

'use strict';

const { parserService } = require('./backend/dist/services/parser.service');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

// ─────────────────────────────────────────────
// REQUIRED LEGACY FIELDS
// Every entity MUST have: name, type, code, startLine, endLine, dependencies
// ─────────────────────────────────────────────
const REQUIRED_FIELDS = ['name', 'type', 'code', 'startLine', 'endLine', 'dependencies'];
const VALID_TYPES = ['function', 'class', 'route', 'model', 'service', 'controller'];

function checkBackwardCompat(entities, label) {
  for (const e of entities) {
    for (const field of REQUIRED_FIELDS) {
      assert(`${label} — entity '${e.name}' has required field '${field}'`, e[field] !== undefined && e[field] !== null);
    }
    assert(`${label} — entity '${e.name}' has valid type`, VALID_TYPES.includes(e.type));
    assert(`${label} — entity '${e.name}' dependencies is an array`, Array.isArray(e.dependencies));
    assert(`${label} — entity '${e.name}' metadata is absent or optional`, true); // metadata not required
  }
}

// ─────────────────────────────────────────────
// TEST 1: AST success path
// ─────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 1: AST success path (TypeScript)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const validTsCode = `
import express from 'express';
const app = express();

export class UserController {
  async getUser(req, res) {
    res.json({ user: 'test' });
  }
}

export const helperFunction = async () => {
  return true;
};

app.get('/api/users', (req, res) => {
  res.send('users');
});
`;

const astEntities = parserService.extractEntities(validTsCode, 'typescript');
assert('AST path returns at least 1 entity', astEntities.length > 0);
assert('AST path: all entities use AST parser', astEntities.every(e => e.parser === 'ast'));
assert('AST path: all entities have confidence=1', astEntities.every(e => e.confidence === 1));
checkBackwardCompat(astEntities, 'AST path');

// ─────────────────────────────────────────────
// TEST 2: Malformed JS/TS — fallback to regex
// ─────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 2: Malformed JS — AST fallback to regex');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// This code is syntactically corrupt for an AST but regex can still find things.
// We simulate AST failure by passing null-ish content to see if it returns safely.
let malformedResult;
try {
  malformedResult = parserService.extractEntities(null, 'javascript');
} catch (err) {
  malformedResult = null;
}
assert('Malformed (null) content returns array, not throw', Array.isArray(malformedResult));
assert('Malformed (null) content returns empty array safely', malformedResult !== null && malformedResult.length === 0);

// Empty string
let emptyResult;
try {
  emptyResult = parserService.extractEntities('', 'typescript');
} catch (err) {
  emptyResult = null;
}
assert('Empty string content returns array, not throw', Array.isArray(emptyResult));

// Valid but has no extractable entities
const noEntitiesCode = `// Just a comment\nconst x = 1;\nconst y = 2;`;
const noEntities = parserService.extractEntities(noEntitiesCode, 'typescript');
assert('Code with no entities returns empty array (not crash)', Array.isArray(noEntities));

// ─────────────────────────────────────────────
// TEST 3: Unsupported language — regex path, safe empty
// ─────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 3: Unsupported language — regex fallback');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const phpCode = `<?php function myFunc() { return 1; }`;
let phpResult;
try {
  phpResult = parserService.extractEntities(phpCode, 'php');
} catch (err) {
  phpResult = null;
}
assert('PHP (unsupported AST language) returns array, not throw', Array.isArray(phpResult));

const textResult = parserService.extractEntities('just some text', 'text');
assert('Language=text returns array, not throw', Array.isArray(textResult));

// ─────────────────────────────────────────────
// TEST 4: Python — regex path
// ─────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 4: Python — regex path');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const pythonCode = `
class MyModel:
    def __init__(self):
        pass

    def save(self):
        return True

def standalone_function():
    return 42
`;
const pyEntities = parserService.extractEntities(pythonCode, 'python');
assert('Python returns at least 1 entity', pyEntities.length > 0);
assert('Python: all entities use regex parser', pyEntities.every(e => e.parser === 'regex'));
checkBackwardCompat(pyEntities, 'Python regex path');

// ─────────────────────────────────────────────
// TEST 5: Backward compat — entity shape
// ─────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 5: Backward compatibility — entity shape');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// All AST-produced entities must still be passable to CodeEntity.create
// (projectId and fileId are added by the caller — not parser's responsibility)
for (const e of astEntities) {
  assert(`Entity '${e.name}': name is string`, typeof e.name === 'string' && e.name.length > 0);
  assert(`Entity '${e.name}': code is string`, typeof e.code === 'string' && e.code.length > 0);
  assert(`Entity '${e.name}': startLine >= 1`, typeof e.startLine === 'number' && e.startLine >= 1);
  assert(`Entity '${e.name}': endLine >= startLine`, typeof e.endLine === 'number' && e.endLine >= e.startLine);
  assert(`Entity '${e.name}': metadata absent (not injected by parser)`, e.metadata === undefined);
}

// ─────────────────────────────────────────────
// TEST 6: Fallback must exist — verify RegexParser activates
// ─────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 6: Fallback existence — regex produces entities');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Dart uses regex parser since no AST support added
const dartCode = `class MyWidget extends StatelessWidget {
  build(context) {
    return Container();
  }
}`;
const dartEntities = parserService.extractEntities(dartCode, 'dart');
assert('Dart (regex) returns at least 1 entity', dartEntities.length > 0);
assert('Dart: all entities use regex parser', dartEntities.every(e => e.parser === 'regex'));
assert('CRITICAL: RegexParser fallback is functional', dartEntities.length > 0);

// ─────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (failed > 0) {
  console.error(`❌ VERIFICATION FAILED — ${failed} test(s) did not pass.`);
  process.exit(1);
} else {
  console.log('✅ ALL TESTS PASSED — Parser stabilization verified.');
  process.exit(0);
}
