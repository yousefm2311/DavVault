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
const contextPath = path.join(BACKEND, 'src', 'services', 'ai-context-builder.service.ts');
const controllerPath = path.join(BACKEND, 'src', 'controllers', 'ai.controller.ts');
const chatSessionPath = path.join(BACKEND, 'src', 'models', 'ChatSession.ts');
const chatPagePath = path.join(FRONTEND, 'src', 'app', 'chat', 'page.tsx');
const projectPagePath = path.join(FRONTEND, 'src', 'app', 'projects', '[id]', 'page.tsx');

console.log('\nAI Citation Navigation verification');
console.log('===================================');

const contextSrc = read(contextPath);
const controllerSrc = read(controllerPath);
const chatSessionSrc = read(chatSessionPath);
const chatPageSrc = read(chatPagePath);
const projectPageSrc = read(projectPagePath);

console.log('\nTEST 1: Backend navigation metadata');
assert('ContextCitation has navigation field', contextSrc.includes('navigation?:') && contextSrc.includes('route?: string'));
assert('navigation metadata supports projectId/fileId/entityId', [
  'projectId?: string',
  'fileId?: string',
  'entityId?: string',
].every((field) => contextSrc.includes(field)));
assert('buildCitationNavigation helper exists', contextSrc.includes('buildCitationNavigation'));
assert('source asset navigation routes to safe project file view', contextSrc.includes('`/projects/${safeProjectId}?fileId=${safeFileId}`'));
assert('snippet citations route to snippets page with safe id', contextSrc.includes('`/snippets?id=${safeId}`'));
assert('debugging lesson citations route to errors page with safe id', contextSrc.includes('`/errors?id=${safeId}`'));
assert('architecture blueprint citations route to systems page with safe id', contextSrc.includes('`/systems?id=${safeId}`'));
assert('memory/knowledge relationship citations do not force routes', !/ctx\.relevantMemory\.forEach[\s\S]*navigation:/.test(contextSrc) && !/ctx\.relatedRelationships\.forEach[\s\S]*navigation:/.test(contextSrc));
assert('ChatSession citation schema persists navigation safely', chatSessionSrc.includes('navigation:') && chatSessionSrc.includes('route: { type: String }'));
assert('legacy citation normalization keeps navigation additive and safe', controllerSrc.includes('normalizeCitationId(projectId)') && controllerSrc.includes('mergeCitations'));

console.log('\nTEST 2: Chat page click-through');
assert('chat Citation interface includes navigation', chatPageSrc.includes('navigation?:') && chatPageSrc.includes('route?: string'));
assert('chat has citation open handler', chatPageSrc.includes('const handleOpenCitation = (cit: Citation)'));
assert('chat pushes only safe navigation routes', chatPageSrc.includes('isSafeCitationRoute') && chatPageSrc.includes('router.push(route)'));
assert('chat can fallback to project file navigation', chatPageSrc.includes('sourceFiles.find') && chatPageSrc.includes('router.push(`/projects/${selectedProjectId}?fileId=${matchedFile._id}`)'));
assert('legacy code citations can still open drawer', chatPageSrc.includes('setDrawerCode(cit.code)'));
assert('chat has clickable citation resolver', chatPageSrc.includes('const canOpenCitation = (cit: Citation)'));
assert('chat clickable citations get role/title/aria/cursor', [
  'role={canOpenCitation(c) ?',
  'title={canOpenCitation(c) ?',
  'aria-label={canOpenCitation(c) ?',
  'cursor-pointer',
].every((item) => chatPageSrc.includes(item)));
assert('chat keyboard activation exists', chatPageSrc.includes("event.key === 'Enter'") && chatPageSrc.includes("event.key === ' '"));

console.log('\nTEST 3: Project details click-through');
assert('project Citation interface includes navigation', projectPageSrc.includes('navigation?:') && projectPageSrc.includes('fileId?: string'));
assert('project source citation detector exists', projectPageSrc.includes('isSourceAssetCitation'));
assert('project citation click helper exists', projectPageSrc.includes('const handleCitationClick = (citation: Citation)'));
assert('project source citations select existing file', projectPageSrc.includes('handleFileSelect(matchedFile)') && projectPageSrc.includes("setActiveTab('files')"));
assert('project source citations match fileId/path/fileName safely', [
  'file._id === citation.navigation?.fileId',
  'file.path === citation.path',
  'file.fileName === citation.fileName',
].every((item) => projectPageSrc.includes(item)));
assert('project routed citations can navigate only through safe route guard', projectPageSrc.includes('isSafeCitationRoute') && projectPageSrc.includes('router.push(route)'));
assert('project memory/relationship citations remain safe when non-clickable', projectPageSrc.includes('isCitationClickable(citation) ?') && projectPageSrc.includes("role={isCitationClickable(citation) ? 'button' : undefined}"));

console.log('\nTEST 4: No code bodies in citations');
assert('controller does not return code on citations', ![
  'code: c.code',
  'code: c.content',
  'code: entity.code',
  'code: c.content.substring',
].some((item) => controllerSrc.includes(item)));
assert('ChatSession citation schema has no code field', !chatSessionSrc.includes('code: { type: String }'));
assert('ContextCitation has no content field', !/export interface ContextCitation[\s\S]*content\??:/.test(contextSrc.slice(contextSrc.indexOf('export interface ContextCitation'), contextSrc.indexOf('export type ContextRelationship'))));

console.log('\nTEST 5: Builds');
run('backend build passes', 'npm run build', BACKEND);
run('frontend build passes', 'npm run build', FRONTEND);

console.log('\nRESULTS');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) process.exit(1);
process.exit(0);
