'use strict';

const fs = require('fs');
const path = require('path');

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

function sliceBetween(content, startMarker, endMarker) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, start + startMarker.length);
  if (start === -1 || end === -1) return '';
  return content.slice(start, end);
}

const ROOT = __dirname;
const controller = read(path.join(ROOT, 'backend/src/controllers/ai.controller.ts'));
const aiService = read(path.join(ROOT, 'backend/src/services/ai.service.ts'));
const contextBuilder = read(path.join(ROOT, 'backend/src/services/ai-context-builder.service.ts'));
const chatPage = read(path.join(ROOT, 'frontend/src/app/chat/page.tsx'));
const projectPage = read(path.join(ROOT, 'frontend/src/app/projects/[id]/page.tsx'));

const handlers = [
  ['handleChat', 'export const handleChat', 'export const explainCodeFile', 'AI_CHAT_FAILED'],
  ['explainCodeFile', 'export const explainCodeFile', 'export const debugContextTrace', 'AI_EXPLAIN_FAILED'],
  ['getSessions', 'export const getSessions', 'export const getSessionById', 'AI_SESSIONS_LIST_FAILED'],
  ['getSessionById', 'export const getSessionById', 'export const deleteSession', 'AI_SESSION_READ_FAILED'],
  ['deleteSession', 'export const deleteSession', 'export const simulateTeamDiscussion', 'AI_SESSION_DELETE_FAILED'],
  ['simulateTeamDiscussion', 'export const simulateTeamDiscussion', 'export const getAgents', 'AI_TEAM_SIMULATION_FAILED'],
  ['getAgents', 'export const getAgents', 'export const createAgent', 'AI_AGENTS_LIST_FAILED'],
  ['createAgent', 'export const createAgent', 'export const deleteAgent', 'AI_AGENT_CREATE_FAILED'],
  ['deleteAgent', 'export const deleteAgent', undefined, 'AI_AGENT_DELETE_FAILED'],
];

console.log('\nAI Chat Error Contract verification');
console.log('===================================');

console.log('\nTEST 1: Shared safe error contract helpers');
assert('invalid id helper returns 400 INVALID_OBJECT_ID', controller.includes('res.status(400).json') && controller.includes('INVALID_OBJECT_ID'));
assert('not found helper includes required codes', ['PROJECT_NOT_FOUND', 'FILE_NOT_FOUND', 'CHAT_SESSION_NOT_FOUND'].every((code) => controller.includes(code)));
assert('AI server error helper returns stable error and code', controller.includes('aiServerErrorResponse') && controller.includes('An unexpected AI service error occurred.'));
assert('controller does not return raw error.message', !controller.includes('error: error.message'));
assert('controller does not return raw stack traces', !controller.includes('error.stack') && !controller.includes('stack:'));

console.log('\nTEST 2: Handler 500 contracts');
for (const [name, start, end, code] of handlers) {
  const body = end ? sliceBetween(controller, start, end) : controller.slice(controller.indexOf(start));
  assert(`${name} handler exists`, Boolean(body));
  assert(`${name} returns stable 500 code`, body.includes(`'${code}'`) || body.includes(code));
  assert(`${name} does not return raw error.message`, !body.includes('error.message'));
}

console.log('\nTEST 3: Required 400/404 contracts');
assert('chat invalid ids return INVALID_OBJECT_ID', sliceBetween(controller, 'export const handleChat', 'export const explainCodeFile').includes("invalidIdResponse(res, 'projectId')") && sliceBetween(controller, 'export const handleChat', 'export const explainCodeFile').includes("invalidIdResponse(res, 'sessionId')"));
assert('explain invalid ids return INVALID_OBJECT_ID', sliceBetween(controller, 'export const explainCodeFile', 'export const debugContextTrace').includes("invalidIdResponse(res, 'projectId')") && sliceBetween(controller, 'export const explainCodeFile', 'export const debugContextTrace').includes("invalidIdResponse(res, 'fileId')"));
assert('trace invalid ids return INVALID_OBJECT_ID', sliceBetween(controller, 'export const debugContextTrace', 'export const getSessions').includes("invalidIdResponse(res, 'projectId')") && sliceBetween(controller, 'export const debugContextTrace', 'export const getSessions').includes("invalidIdResponse(res, 'fileId')"));
assert('sessions invalid ids return INVALID_OBJECT_ID', sliceBetween(controller, 'export const getSessions', 'export const simulateTeamDiscussion').includes("invalidIdResponse(res, 'projectId')") && sliceBetween(controller, 'export const getSessionById', 'export const deleteSession').includes("invalidIdResponse(res, 'sessionId')"));
assert('missing project/file/session not found codes exist', ['PROJECT_NOT_FOUND', 'FILE_NOT_FOUND', 'CHAT_SESSION_NOT_FOUND'].every((code) => controller.includes(code)));

console.log('\nTEST 4: AI service fallback safety');
assert('AI service supports no-key fallback mode', aiService.includes('No API keys detected') && aiService.includes('offline mock mode'));
assert('AI service provider failures fall back instead of throwing to controller', aiService.includes('trying fallback') && aiService.includes('Mock Answer'));
assert('AI prompts forbid secrets', aiService.includes('Do NOT expose secrets') && aiService.includes('API keys') && aiService.includes('tokens'));
assert('AI prompts forbid invented files or relationships', aiService.includes('Do NOT invent files') && aiService.includes('Do not invent relationships'));
assert('AI prompts tell model to say context is insufficient', aiService.includes('context is insufficient') || aiService.includes('insufficient'));

console.log('\nTEST 5: Context builder warning contract');
assert('context builder returns warnings field', contextBuilder.includes('warnings: string[]') && contextBuilder.includes('warnings: []'));
assert('search failures become warnings', contextBuilder.includes('Search retrieval warning'));
assert('memory failures become warnings', contextBuilder.includes('Memory retrieval warning'));
assert('graph failures become warnings', contextBuilder.includes('Graph relationship warning'));
assert('empty context preserves response shape', contextBuilder.includes('const emptyContext') && contextBuilder.includes('primaryCodeContext: []') && contextBuilder.includes('citations: []'));

console.log('\nTEST 6: Frontend stable failed-response handling');
assert('chat page has initial loading state', chatPage.includes('loadingInitialData') && chatPage.includes('AppPageSkeleton'));
assert('chat page renders chat error state', chatPage.includes('chatError') && chatPage.includes('Unable to load chat workspace.'));
assert('chat page uses safe empty answer fallback', chatPage.includes('The AI service did not return an answer.'));
assert('chat send button disabled while sending', chatPage.includes('disabled={sending || !inputMsg.trim()}'));
assert('project chat uses safe empty answer fallback', projectPage.includes('The AI service did not return an answer.'));
assert('project explain uses safe empty explanation fallback', projectPage.includes('The AI service did not return an explanation.'));
assert('project explain and chat have visible error states', projectPage.includes('explanationError') && projectPage.includes('projectChatError'));

if (failed > 0) {
  console.error(`\nFAILED: ${failed} check(s) failed.`);
  process.exit(1);
}

console.log(`\nPASSED: ${passed} checks passed.`);
process.exit(0);
