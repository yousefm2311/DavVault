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
const contextBuilder = read(path.join(ROOT, 'backend/src/services/ai-context-builder.service.ts'));
const chatPage = read(path.join(ROOT, 'frontend/src/app/chat/page.tsx'));
const projectPage = read(path.join(ROOT, 'frontend/src/app/projects/[id]/page.tsx'));

const chatHandler = sliceBetween(controller, 'export const handleChat', 'export const explainCodeFile');
const explainHandler = sliceBetween(controller, 'export const explainCodeFile', 'export const debugContextTrace');
const traceHandler = sliceBetween(controller, 'export const debugContextTrace', 'export const getSessions');
const sessionsHandler = sliceBetween(controller, 'export const getSessions', 'export const getSessionById');
const getSessionHandler = sliceBetween(controller, 'export const getSessionById', 'export const deleteSession');
const deleteSessionHandler = sliceBetween(controller, 'export const deleteSession', 'export const simulateTeamDiscussion');
const teamHandler = sliceBetween(controller, 'export const simulateTeamDiscussion', 'export const getAgents');

console.log('\nAI Project Scope Safety verification');
console.log('====================================');

console.log('\nTEST 1: Shared backend guards');
assert('ObjectId validation helper exists', controller.includes('const isValidObjectId'));
assert('safe invalid id response exists', controller.includes('INVALID_OBJECT_ID') && controller.includes('invalidIdResponse'));
assert('safe not found codes exist', controller.includes('PROJECT_NOT_FOUND') && controller.includes('FILE_NOT_FOUND') && controller.includes('CHAT_SESSION_NOT_FOUND'));
assert('workspace-aware project access filter exists', controller.includes('accessibleProjectFilter') && controller.includes("members.userId") && controller.includes('workspaceId'));
assert('accessible project lookup helper exists', controller.includes('findAccessibleProject'));

console.log('\nTEST 2: Chat endpoint scope safety');
assert('chat validates projectId', chatHandler.includes("invalidIdResponse(res, 'projectId')"));
assert('chat validates sessionId', chatHandler.includes("invalidIdResponse(res, 'sessionId')"));
assert('chat uses accessible project lookup', chatHandler.includes('findAccessibleProject(userId, projectId'));
assert('chat returns PROJECT_NOT_FOUND for missing project', chatHandler.includes('PROJECT_NOT_FOUND'));
assert('chat returns CHAT_SESSION_NOT_FOUND for missing session', chatHandler.includes('CHAT_SESSION_NOT_FOUND'));
assert('chat legacy file lookup scoped to context owner and project', chatHandler.includes('userId: contextOwnerId') && chatHandler.includes('fileFilter.projectId = projectId'));
assert('chat code entity lookup validates ids and file owner', chatHandler.includes('isValidObjectId(c.sourceId?.toString())') && chatHandler.includes('file.userId?.toString() === contextOwnerId'));
assert('custom agent ids are validated before Mongoose', chatHandler.includes('if (!isValidObjectId(agentIdOrName)) continue;'));

console.log('\nTEST 3: Explain and trace scope safety');
assert('explain validates projectId and fileId', explainHandler.includes("invalidIdResponse(res, 'projectId')") && explainHandler.includes("invalidIdResponse(res, 'fileId')"));
assert('explain uses accessible project lookup', explainHandler.includes('findAccessibleProject(userId, projectId'));
assert('explain file lookup requires context owner and project', explainHandler.includes('userId: contextOwnerId') && explainHandler.includes('fileFilter.projectId = projectId'));
assert('explain passes contextOwnerId to context builder', explainHandler.includes('contextOwnerId,'));
assert('trace validates projectId and fileId as 400 invalid id', traceHandler.includes("invalidIdResponse(res, 'projectId')") && traceHandler.includes("invalidIdResponse(res, 'fileId')"));
assert('trace uses accessible project lookup', traceHandler.includes('findAccessibleProject(userId, projectId'));
assert('trace file lookup requires context owner and project', traceHandler.includes('userId: contextOwnerId') && traceHandler.includes('fileFilter.projectId = projectId'));

console.log('\nTEST 4: Sessions and team simulation scope safety');
assert('session list validates project filter', sessionsHandler.includes("invalidIdResponse(res, 'projectId')"));
assert('session list checks project access before filtering', sessionsHandler.includes('findAccessibleProject(req.user.id, projectId'));
assert('get session validates id and scopes user', getSessionHandler.includes("invalidIdResponse(res, 'sessionId')") && getSessionHandler.includes('userId: req.user.id'));
assert('delete session validates id and scopes user', deleteSessionHandler.includes("invalidIdResponse(res, 'sessionId')") && deleteSessionHandler.includes('findOneAndDelete({ _id: id, userId: req.user.id })'));
assert('team simulation validates projectId', teamHandler.includes("invalidIdResponse(res, 'projectId')"));
assert('team simulation checks project access and context owner', teamHandler.includes('findAccessibleProject(req.user.id, projectId') && teamHandler.includes('contextOwnerId'));
assert('team simulation file reads scoped to project and owner', teamHandler.includes('projectId, userId: contextOwnerId'));

console.log('\nTEST 5: Context builder isolates invalid optional ids');
assert('context builder has ObjectId helper', contextBuilder.includes('isValidObjectIdString'));
assert('chat context ignores invalid project/session ids with warnings', contextBuilder.includes('Ignored invalid projectId') && contextBuilder.includes('Ignored invalid sessionId'));
assert('explain context accepts contextOwnerId', contextBuilder.includes('contextOwnerId?: string'));
assert('explain context ignores invalid project/file ids with warnings', contextBuilder.includes('ContextBuilder/Explain]: Ignored invalid projectId') && contextBuilder.includes('ContextBuilder/Explain]: Ignored invalid fileId'));
assert('context builder scopes file lookups to owner', contextBuilder.includes('userId: ownerId'));
assert('citation navigation normalizes ids', contextBuilder.includes('safeProjectId') && contextBuilder.includes('safeFileId') && contextBuilder.includes('safeEntityId'));

console.log('\nTEST 6: Frontend chat/project safety');
assert('chat page validates project ids', chatPage.includes('isValidObjectIdString') && chatPage.includes('Invalid project id.'));
assert('chat page has load and source file error states', chatPage.includes('chatError') && chatPage.includes('sourceFilesError'));
assert('chat page validates citation routes', chatPage.includes('isSafeCitationRoute') && chatPage.includes('/^\\/projects\\/'));
assert('chat page normalizes legacy project ids', chatPage.includes('Temporary compatibility for legacy responses') && chatPage.includes('normalizeProjectId'));
assert('project details explain has error state', projectPage.includes('explanationError') && projectPage.includes('Unable to explain this file right now.'));
assert('project details chat has error state', projectPage.includes('projectChatError') && projectPage.includes('Unable to send this message right now.'));

if (failed > 0) {
  console.error(`\nFAILED: ${failed} check(s) failed.`);
  process.exit(1);
}

console.log(`\nPASSED: ${passed} checks passed.`);
process.exit(0);
