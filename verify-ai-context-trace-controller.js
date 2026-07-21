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

function sliceBetween(content, startMarker, endMarker) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, start + startMarker.length);
  if (start === -1 || end === -1) return '';
  return content.slice(start, end);
}

function objectBlock(content, marker) {
  const markerIndex = content.indexOf(marker);
  if (markerIndex === -1) return '';
  const open = content.indexOf('{', markerIndex);
  if (open === -1) return '';

  let depth = 0;
  for (let i = open; i < content.length; i++) {
    const char = content[i];
    if (char === '{') depth++;
    if (char === '}') depth--;
    if (depth === 0) return content.slice(open, i + 1);
  }
  return '';
}

const ROOT = __dirname;
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');
const controllerPath = path.join(BACKEND, 'src', 'controllers', 'ai.controller.ts');
const routePath = path.join(BACKEND, 'src', 'routes', 'ai.routes.ts');

console.log('\nAI Context Trace Controller verification');
console.log('========================================');

const controller = read(controllerPath);
const routes = read(routePath);
const handler = sliceBetween(
  controller,
  'export const debugContextTrace',
  'export const getSessions'
);
const responseBlock = objectBlock(handler, 'return res.status(200).json');
const selectedRelationshipsBlock = objectBlock(responseBlock, 'selectedRelationships');
const selectedMemoryBlock = objectBlock(responseBlock, 'selectedMemory');

console.log('\nTEST 1: Backend build');
run('backend build passes', 'npm run build', BACKEND);

console.log('\nTEST 2: Endpoint and route wiring');
assert('debugContextTrace handler exists', controller.includes('export const debugContextTrace'));
assert('debug context route exists', routes.includes("'/debug/context-trace'"));
assert('route requires auth', /router\.post\('\/debug\/context-trace',\s*authenticate/.test(routes));
assert('route does not use plan-limit billing middleware', !/router\.post\('\/debug\/context-trace'[\s\S]*checkPlanLimits/.test(routes));
assert('route validates message and mode', routes.includes("validateBody(['message', 'mode'])"));

console.log('\nTEST 3: Production disable path');
assert('production guard helper exists', controller.includes('isContextTraceEnabled'));
assert('production guard checks NODE_ENV', controller.includes("process.env.NODE_ENV !== 'production'"));
assert('AI_DEBUG_CONTEXT_TRACE=true override exists', controller.includes("process.env.AI_DEBUG_CONTEXT_TRACE === 'true'"));
assert('handler checks production guard before context builder', handler.indexOf('!isContextTraceEnabled()') !== -1 && handler.indexOf('!isContextTraceEnabled()') < handler.indexOf('aiContextBuilder'));
assert('disabled response path exists', handler.includes('AI_CONTEXT_TRACE_DISABLED') && handler.includes('AI context trace debug endpoint is disabled.'));

console.log('\nTEST 4: Ownership and mode checks');
assert('requires authenticated user in handler', handler.includes('if (!req.user) return res.status(401)'));
assert('validates chat/explain mode', handler.includes("mode !== 'chat'") && handler.includes("mode !== 'explain'"));
assert('validates project ObjectId safely', handler.includes("invalidIdResponse(res, 'projectId')"));
assert('validates file ObjectId safely', handler.includes("invalidIdResponse(res, 'fileId')"));
assert('project lookup uses workspace-aware access helper', handler.includes('findAccessibleProject(userId, projectId'));
assert('file lookup is scoped by context owner', handler.includes('const fileFilter: any = { _id: fileId, userId: contextOwnerId }'));
assert('file lookup is scoped to project when provided', handler.includes('if (projectId) fileFilter.projectId = projectId'));
assert('project not found response exists', handler.includes('PROJECT_NOT_FOUND'));
assert('file not found response exists', handler.includes('FILE_NOT_FOUND'));

console.log('\nTEST 5: Context builder calls');
assert('chat mode calls buildChatContext', handler.includes('buildChatContext'));
assert('explain mode calls buildExplainCodeContext', handler.includes('buildExplainCodeContext'));
assert('chat mode does not require live server session', !handler.includes('req.app.listen') && !handler.includes('supertest'));
assert('debug response shape does not alter normal chat/explain responses', controller.includes('sessionId: session._id') && controller.includes('answer') && controller.includes('explanation'));

console.log('\nTEST 6: Sanitization and secret redaction');
assert('sanitizeTraceText helper exists', controller.includes('const sanitizeTraceText'));
assert('secret pattern list exists', controller.includes('TRACE_SECRET_PATTERNS'));
assert('password-like values are redacted', controller.includes('password'));
assert('token-like values are redacted', controller.includes('token') && controller.includes('bearer'));
assert('API key-like values are redacted', controller.includes('api[_-]?key') && controller.includes('sk-') && controller.includes('AIza'));
assert('process.env values are redacted', controller.includes('process\\.env\\.\\w+'));
assert('private keys are redacted', controller.includes('PRIVATE KEY'));
assert('sanitizer replaces matches with [REDACTED]', controller.includes("safe.replace(pattern, '[REDACTED]')"));

console.log('\nTEST 7: Trace response safe shape');
assert('response returns mode and contextSummary', responseBlock.includes('mode') && responseBlock.includes('contextSummary'));
assert('response returns counts only for broad context categories', [
  'codeChunks',
  'searchResults',
  'snippets',
  'debuggingLessons',
  'architectureBlueprints',
  'memory',
  'relationships',
  'conversationMessages',
].every((field) => responseBlock.includes(field)));
assert('selectedRelationships output exists', responseBlock.includes('selectedRelationships'));
assert('selectedRelationships has only safe requested fields', [
  'relationshipType',
  'sourceDisplayName',
  'targetDisplayName',
  'sourcePath',
  'targetPath',
  'confidence',
  'evidenceReason',
].every((field) => selectedRelationshipsBlock.includes(field)));
assert('selectedRelationships excludes ids and raw metadata', ![
  'sourceId',
  'targetId',
  'metadata',
  'evidenceSnippet',
  'snippet',
].some((field) => selectedRelationshipsBlock.includes(field)));
assert('selectedMemory output exists', responseBlock.includes('selectedMemory'));
assert('selectedMemory has only safe requested fields', [
  'type',
  'scope',
  'title',
  'confidence',
].every((field) => selectedMemoryBlock.includes(field)));
assert('selectedMemory excludes memory content and tags', ![
  /\bcontent\s*:/,
  /\btags\s*:/,
  /\bid\s*:/,
].some((pattern) => pattern.test(selectedMemoryBlock)));
assert('warnings are sanitized', responseBlock.includes('warnings') && responseBlock.includes('sanitizeTraceText(warning'));

console.log('\nTEST 8: No code contents, prompts, or secret fields returned');
assert('response does not return full code contents', ![
  'content:',
  'code:',
  'primaryCodeContext.map',
  'relatedSearchResults.map',
].some((field) => responseBlock.includes(field)));
assert('response does not return raw prompts', !['systemPrompt', 'rawPrompt', 'prompt:'].some((field) => responseBlock.includes(field)));
assert('response does not return secret field names as values', ![
  'accessToken',
  'refreshToken',
  'apiKey',
  'password',
  'process.env',
].some((field) => responseBlock.includes(field)));

console.log('\nTEST 9: Frontend untouched by controller tests');
const frontendFiles = [];
function collectFrontend(dir) {
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!['node_modules', '.next', 'dist', 'build'].includes(item)) collectFrontend(fullPath);
    } else if (/\.(ts|tsx|js|jsx)$/.test(item)) {
      frontendFiles.push(fullPath);
    }
  }
}
collectFrontend(path.join(FRONTEND, 'src'));
const frontend = frontendFiles.map(read).join('\n');
assert('frontend does not reference context-trace', !frontend.includes('context-trace'));
assert('frontend does not reference AI_DEBUG_CONTEXT_TRACE', !frontend.includes('AI_DEBUG_CONTEXT_TRACE'));

console.log('\nRESULTS');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) process.exit(1);
process.exit(0);
