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
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');
const routesPath = path.join(BACKEND, 'src', 'routes', 'ai.routes.ts');
const controllerPath = path.join(BACKEND, 'src', 'controllers', 'ai.controller.ts');

console.log('\nAI Context Trace verification');
console.log('=============================');

const routes = read(routesPath);
const controller = read(controllerPath);
const debugHandler = controller.slice(
  controller.indexOf('export const debugContextTrace'),
  controller.indexOf('export const getSessions')
);

console.log('\nTEST 1: Backend build');
run('backend build passes', 'npm run build', BACKEND);

console.log('\nTEST 2: Debug route exists and is protected');
assert('debug context route exists', routes.includes("'/debug/context-trace'"));
assert('debug route uses authenticate', /router\.post\('\/debug\/context-trace',\s*authenticate/.test(routes));
assert('debug route uses apiLimiter', routes.includes("'/debug/context-trace'") && routes.includes('apiLimiter'));
assert('debug route validates message and mode', routes.includes("validateBody(['message', 'mode'])"));
assert('debug handler exported', controller.includes('export const debugContextTrace'));

console.log('\nTEST 3: Production guard');
assert('production guard helper exists', controller.includes('isContextTraceEnabled'));
assert('production guard checks NODE_ENV', controller.includes("process.env.NODE_ENV !== 'production'"));
assert('AI_DEBUG_CONTEXT_TRACE override exists', controller.includes('AI_DEBUG_CONTEXT_TRACE'));
assert('disabled response exists', debugHandler.includes('AI_CONTEXT_TRACE_DISABLED') && debugHandler.includes('disabled'));

console.log('\nTEST 4: Context builder integration and ownership');
assert('debug handler calls buildChatContext', debugHandler.includes('buildChatContext'));
assert('debug handler calls buildExplainCodeContext', debugHandler.includes('buildExplainCodeContext'));
assert('debug handler supports chat and explain modes', debugHandler.includes("mode !== 'chat'") && debugHandler.includes("mode !== 'explain'"));
assert('project access uses workspace-aware helper', debugHandler.includes('findAccessibleProject(userId, projectId'));
assert('file ownership scoped to context owner', debugHandler.includes('fileFilter') && debugHandler.includes('userId: contextOwnerId'));
assert('missing project returns 404 with code', debugHandler.includes('PROJECT_NOT_FOUND'));
assert('missing file returns 404 with code', debugHandler.includes('FILE_NOT_FOUND'));

console.log('\nTEST 5: Sanitized trace output shape');
assert('returns contextSummary', debugHandler.includes('contextSummary'));
assert('returns requested counts', [
  'codeChunks',
  'searchResults',
  'snippets',
  'debuggingLessons',
  'architectureBlueprints',
  'memory',
  'relationships',
  'conversationMessages',
].every((field) => debugHandler.includes(field)));
assert('returns selectedRelationships', debugHandler.includes('selectedRelationships'));
assert('returns selectedMemory', debugHandler.includes('selectedMemory'));
assert('returns warnings', debugHandler.includes('warnings'));
assert('trace strings pass through sanitizer', debugHandler.includes('sanitizeTraceText'));
assert('secret redaction patterns exist', [
  'password',
  'api[_-]?key',
  'bearer',
  'process\\.env',
  'PRIVATE KEY',
].every((item) => controller.includes(item)));

console.log('\nTEST 6: No full code or prompts returned');
assert('response does not return primary code contents', !debugHandler.includes('primaryCodeContext.map'));
assert('response does not expose raw search results', !debugHandler.includes('relatedSearchResults.map'));
assert('selected memory omits content', debugHandler.includes('selectedMemory') && !/selectedMemory:[\s\S]*content/.test(debugHandler));
assert('selected relationships omit snippets', debugHandler.includes('evidenceReason') && !debugHandler.includes('evidenceSnippet'));
assert('debug handler does not return raw prompts', !debugHandler.includes('systemPrompt') && !debugHandler.includes('rawPrompt'));

console.log('\nTEST 7: Frontend untouched by trace endpoint');
const frontendFiles = [];
function collect(dir) {
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!['node_modules', '.next', 'dist', 'build'].includes(item)) collect(fullPath);
    } else if (/\.(ts|tsx|js|jsx)$/.test(item)) {
      frontendFiles.push(fullPath);
    }
  }
}
collect(path.join(FRONTEND, 'src'));
const frontend = frontendFiles.map(read).join('\n');
assert('frontend does not reference context trace endpoint', !frontend.includes('/debug/context-trace') && !frontend.includes('context-trace'));
assert('frontend does not reference AI_DEBUG_CONTEXT_TRACE', !frontend.includes('AI_DEBUG_CONTEXT_TRACE'));

console.log('\nRESULTS');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) process.exit(1);
process.exit(0);
