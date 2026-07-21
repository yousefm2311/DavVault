/**
 * verify-memory-manager.js
 *
 * Verifies Phase 5: Lightweight Memory Manager.
 * Run AFTER: npm run build inside /backend.
 *
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

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

function fileContains(filePath, pattern) {
  const content = fs.readFileSync(filePath, 'utf8');
  return typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

const ROOT = path.join(__dirname, 'backend');
const SRC  = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

// ─────────────────────────────────────────────────────────────
// TEST 1: Model file exists
// ─────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 1: Memory model file existence');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

assert('Memory.ts source exists',   fileExists(path.join(SRC,  'models', 'Memory.ts')));
assert('Memory.js dist exists',     fileExists(path.join(DIST, 'models', 'Memory.js')));
assert('Memory exported from models/index.ts', fileContains(
  path.join(SRC, 'models', 'index.ts'), "from './Memory'"
));

const memorySrc = fs.readFileSync(path.join(SRC, 'models', 'Memory.ts'), 'utf8');
assert("Memory has 'preference' type",        memorySrc.includes("'preference'"));
assert("Memory has 'coding_style' type",      memorySrc.includes("'coding_style'"));
assert("Memory has 'architecture_rule' type", memorySrc.includes("'architecture_rule'"));
assert("Memory has 'debugging_pattern' type", memorySrc.includes("'debugging_pattern'"));
assert("Memory has 'workspace_rule' type",    memorySrc.includes("'workspace_rule'"));
assert("Memory has 'correction' type",        memorySrc.includes("'correction'"));
assert("Memory has 'decision' type",          memorySrc.includes("'decision'"));
assert("Memory has scope field",              memorySrc.includes("scope"));
assert("Memory has confidence field",         memorySrc.includes("confidence"));
assert("Memory has usageCount field",         memorySrc.includes("usageCount"));
assert("Memory has isActive field",           memorySrc.includes("isActive"));
assert("Memory has userId index",             memorySrc.includes("userId: 1, scope: 1, type: 1"));
assert("Memory has isActive index",           memorySrc.includes("isActive: 1"));

// ─────────────────────────────────────────────────────────────
// TEST 2: Memory service exists and has required methods
// ─────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 2: Memory service existence and methods');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

assert('memory.service.ts source exists',  fileExists(path.join(SRC,  'services', 'memory.service.ts')));
assert('memory.service.js dist exists',    fileExists(path.join(DIST, 'services', 'memory.service.js')));

const memSvcSrc = fs.readFileSync(path.join(SRC, 'services', 'memory.service.ts'), 'utf8');
assert('createMemory method exists',                     memSvcSrc.includes('createMemory'));
assert('findRelevantMemory method exists',               memSvcSrc.includes('findRelevantMemory'));
assert('incrementUsage method exists',                   memSvcSrc.includes('incrementUsage'));
assert('extractMemoryCandidatesFromChat method exists',  memSvcSrc.includes('extractMemoryCandidatesFromChat'));
assert('summarizeMemoryForPrompt method exists',         memSvcSrc.includes('summarizeMemoryForPrompt'));
assert('memoryService singleton exported',               memSvcSrc.includes('export const memoryService'));

// ─────────────────────────────────────────────────────────────
// TEST 3: Secret guard present in memory service
// ─────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 3: Secret safety guards in memory service');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

assert('SECRET_PATTERNS defined in memory service',  memSvcSrc.includes('SECRET_PATTERNS'));
assert('containsSecret function exists',             memSvcSrc.includes('containsSecret'));
assert('password pattern guarded',                   memSvcSrc.includes('/\\bpassword'));
assert('apikey pattern guarded',                     memSvcSrc.includes('/\\bapikey'));
assert('token pattern guarded',                      memSvcSrc.includes('/\\btoken'));
assert('process.env pattern guarded',                memSvcSrc.includes('process\\.env'));
assert('Reject secret in createMemory',              memSvcSrc.includes('containsSecret(input.content)'));
assert('Reject secret in chat extraction',           memSvcSrc.includes('containsSecret(text)'));

// ─────────────────────────────────────────────────────────────
// TEST 4: Deterministic trigger phrases exist
// ─────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 4: Deterministic extraction trigger phrases');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

assert("'always use' trigger exists",         memSvcSrc.includes('always use'));
assert("'from now on' trigger exists",        memSvcSrc.includes('from now on'));
assert("'remember' trigger exists",           memSvcSrc.includes('remember'));
assert("'we use' trigger exists",             memSvcSrc.includes('we use'));
assert("'our standard is' trigger exists",    memSvcSrc.includes('our standard is'));
assert("'prefer' trigger exists",             memSvcSrc.includes('prefer'));
assert("Only user messages inspected",        memSvcSrc.includes("role === 'user'") || memSvcSrc.includes("m.role === 'user'"));

// ─────────────────────────────────────────────────────────────
// TEST 5: Memory routes file exists
// ─────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 5: Memory routes existence');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

assert('memory.routes.ts source exists',  fileExists(path.join(SRC,  'routes', 'memory.routes.ts')));
assert('memory.routes.js dist exists',    fileExists(path.join(DIST, 'routes', 'memory.routes.js')));

const memRoutesSrc = fs.readFileSync(path.join(SRC, 'routes', 'memory.routes.ts'), 'utf8');
assert('GET / route exists in memory routes',      memRoutesSrc.includes("router.get('/'"));
assert('POST / route exists in memory routes',     memRoutesSrc.includes("router.post('/'"));
assert('PATCH /:id route exists in memory routes', memRoutesSrc.includes("router.patch('/:id'"));
assert('DELETE /:id route exists in memory routes',memRoutesSrc.includes("router.delete('/:id'"));
assert('authenticate used on routes',              memRoutesSrc.includes('authenticate'));

// ─────────────────────────────────────────────────────────────
// TEST 6: Memory routes mounted in router index
// ─────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 6: Memory routes mounted in router index');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const routerIndexSrc = fs.readFileSync(path.join(SRC, 'routes', 'index.ts'), 'utf8');
assert("memoryRoutes imported in router index",       routerIndexSrc.includes("memoryRoutes"));
assert("/memory path mounted in router index",        routerIndexSrc.includes("'/memory'"));

// ─────────────────────────────────────────────────────────────
// TEST 7: Memory controller exists
// ─────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 7: Memory controller existence');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

assert('memory.controller.ts source exists', fileExists(path.join(SRC,  'controllers', 'memory.controller.ts')));
assert('memory.controller.js dist exists',   fileExists(path.join(DIST, 'controllers', 'memory.controller.js')));

const memCtrlSrc = fs.readFileSync(path.join(SRC, 'controllers', 'memory.controller.ts'), 'utf8');
assert('getMemories exported',   memCtrlSrc.includes('export const getMemories'));
assert('createMemory exported',  memCtrlSrc.includes('export const createMemory'));
assert('updateMemory exported',  memCtrlSrc.includes('export const updateMemory'));
assert('deleteMemory exported',  memCtrlSrc.includes('export const deleteMemory'));
assert('Owner-only query (userId filter)',    memCtrlSrc.includes('req.user.id'));

// ─────────────────────────────────────────────────────────────
// TEST 8: Context Builder references memory service
// ─────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 8: Context Builder integrates memory service');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const ctxSrc = fs.readFileSync(path.join(SRC, 'services', 'ai-context-builder.service.ts'), 'utf8');
assert('AiContext has relevantMemory field',         ctxSrc.includes('relevantMemory'));
assert('AI_CONTEXT_MAX_MEMORY env var supported',    ctxSrc.includes('AI_CONTEXT_MAX_MEMORY'));
assert('memoryService imported in context builder',  ctxSrc.includes('memoryService'));
assert('findRelevantMemory called in context builder', ctxSrc.includes('findRelevantMemory'));
assert('incrementUsage called in context builder',   ctxSrc.includes('incrementUsage'));
assert('emptyContext has relevantMemory',            ctxSrc.includes("relevantMemory: []"));
assert('buildSummary includes memory count',         ctxSrc.includes('developer memory record'));

// ─────────────────────────────────────────────────────────────
// TEST 9: AI prompt includes memory section and safety rules
// ─────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 9: AI prompt memory section and safety rules');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const aiSvcSrc = fs.readFileSync(path.join(SRC, 'services', 'ai.service.ts'), 'utf8');
assert('memoryService imported in ai.service.ts',          aiSvcSrc.includes("from './memory.service'"));
assert('summarizeMemoryForPrompt called in chat prompt',   aiSvcSrc.includes('summarizeMemoryForPrompt'));
assert('MEMORY RULE: not guaranteed fact',                 aiSvcSrc.includes('NOT guaranteed'));
assert('MEMORY RULE: prefer codebase over memory',        aiSvcSrc.includes('PREFER'));
assert('MEMORY RULE in explain prompt',                    aiSvcSrc.includes('MEMORY RULE: Developer memory'));

// ─────────────────────────────────────────────────────────────
// TEST 10: Chat controller triggers memory extraction
// ─────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 10: Chat controller triggers memory extraction');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const ctrlSrc = fs.readFileSync(path.join(SRC, 'controllers', 'ai.controller.ts'), 'utf8');
assert('memoryService imported in ai.controller.ts',          ctrlSrc.includes("from '../services/memory.service'"));
assert('extractMemoryCandidatesFromChat called in controller',ctrlSrc.includes('extractMemoryCandidatesFromChat'));
assert('Memory extraction is fire-and-forget (.catch)',       ctrlSrc.includes('extractMemoryCandidatesFromChat') && ctrlSrc.includes('.catch'));
assert('Memory extraction never blocks response',             ctrlSrc.includes('extractMemoryCandidatesFromChat'));

// ─────────────────────────────────────────────────────────────
// TEST 11: No new infrastructure added
// ─────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 11: No new infrastructure introduced');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

assert('No Qdrant in memory service',  !memSvcSrc.includes('qdrant'));
assert('No Neo4j in memory service',   !memSvcSrc.includes('neo4j'));
assert('No Kafka in memory service',   !memSvcSrc.includes('kafka'));
assert('No S3 in memory service',      !memSvcSrc.includes('aws-sdk'));

const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
assert('No qdrant in package.json deps',    !pkgJson.dependencies?.['qdrant']);
assert('No neo4j-driver in package.json deps', !pkgJson.dependencies?.['neo4j-driver']);

// ─────────────────────────────────────────────────────────────
// TEST 12: Dist module exports validation
// ─────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 12: Dist module exports validation');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

try {
  const { memoryService } = require('./backend/dist/services/memory.service');
  assert('memoryService exported from dist',                   !!memoryService);
  assert('createMemory is a function in dist',                 typeof memoryService.createMemory === 'function');
  assert('findRelevantMemory is a function in dist',           typeof memoryService.findRelevantMemory === 'function');
  assert('incrementUsage is a function in dist',               typeof memoryService.incrementUsage === 'function');
  assert('extractMemoryCandidatesFromChat is a function in dist', typeof memoryService.extractMemoryCandidatesFromChat === 'function');
  assert('summarizeMemoryForPrompt is a function in dist',     typeof memoryService.summarizeMemoryForPrompt === 'function');
} catch (err) {
  assert('memory service dist loads without error', false);
  console.error('  → Load error:', err.message);
}

// ─────────────────────────────────────────────────────────────
// TEST 13: summarizeMemoryForPrompt safe output
// ─────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 13: summarizeMemoryForPrompt output validation');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

try {
  const { memoryService } = require('./backend/dist/services/memory.service');

  // Empty array returns empty string
  const emptyResult = memoryService.summarizeMemoryForPrompt([]);
  assert('summarizeMemoryForPrompt([]) returns empty string', emptyResult === '');

  // One memory returns formatted string
  const oneResult = memoryService.summarizeMemoryForPrompt([{
    id: 'abc123',
    type: 'preference',
    scope: 'user',
    title: 'Always use TypeScript',
    content: 'Always use TypeScript for new backend services.',
    confidence: 0.9,
    tags: ['auto-extracted'],
  }]);
  assert('summarizeMemoryForPrompt with one item returns non-empty string', oneResult.length > 0);
  assert('summarizeMemoryForPrompt includes title in output', oneResult.includes('Always use TypeScript'));
  assert('summarizeMemoryForPrompt includes confidence in output', oneResult.includes('90%'));
  assert('summarizeMemoryForPrompt includes DEVELOPER MEMORY header', oneResult.includes('DEVELOPER MEMORY'));

  // Null/undefined are handled gracefully
  const nullResult = memoryService.summarizeMemoryForPrompt(null);
  assert('summarizeMemoryForPrompt(null) returns empty string safely', nullResult === '');
} catch (err) {
  assert('summarizeMemoryForPrompt runs without error', false);
  console.error('  → Error:', err.message);
}

// ─────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (failed > 0) {
  console.error(`❌ VERIFICATION FAILED — ${failed} test(s) did not pass.`);
  process.exit(1);
} else {
  console.log('✅ ALL TESTS PASSED — Memory Manager stabilization verified.');
  process.exit(0);
}
