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

const ROOT = __dirname;
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');
const contextPath = path.join(BACKEND, 'src', 'services', 'ai-context-builder.service.ts');
const controllerPath = path.join(BACKEND, 'src', 'controllers', 'ai.controller.ts');
const chatSessionPath = path.join(BACKEND, 'src', 'models', 'ChatSession.ts');
const chatPagePath = path.join(FRONTEND, 'src', 'app', 'chat', 'page.tsx');
const projectPagePath = path.join(FRONTEND, 'src', 'app', 'projects', '[id]', 'page.tsx');

console.log('\nAI Citations verification');
console.log('=========================');

const contextSrc = read(contextPath);
const controllerSrc = read(controllerPath);
const chatSessionSrc = read(chatSessionPath);
const chatPageSrc = read(chatPagePath);
const projectPageSrc = read(projectPagePath);
const explainHandler = sliceBetween(controllerSrc, 'export const explainCodeFile', 'export const debugContextTrace');
const chatHandler = sliceBetween(controllerSrc, 'export const handleChat', 'export const explainCodeFile');
const contextCitationInterface = sliceBetween(contextSrc, 'export interface ContextCitation', 'export type ContextRelationship');

console.log('\nTEST 1: Backend normalized citation shape');
assert('ContextCitation interface exists', contextSrc.includes('export interface ContextCitation'));
assert('AiContext has citations field', contextSrc.includes('citations: ContextCitation[]'));
assert('empty context initializes citations', contextSrc.includes('citations: []'));
assert('buildCitations method exists', contextSrc.includes('private buildCitations'));
assert('citation shape includes safe fields', [
  'id: string',
  'type: string',
  'domainType: string',
  'title: string',
  'subtitle?: string',
  'path?: string',
  'relationshipType?: string',
  'confidence?: number',
  'source:',
].every((field) => contextSrc.includes(field)));
assert('citation source enum includes required sources', [
  "'code'",
  "'search'",
  "'memory'",
  "'debugging_lesson'",
  "'architecture_blueprint'",
  "'knowledge_relationship'",
].every((source) => contextSrc.includes(source)));
assert('citations are built for code, memory, lessons, blueprints, relationships', [
  'ctx.primaryCodeContext.forEach',
  'ctx.relevantMemory.forEach',
  'ctx.relatedDebuggingLessons.forEach',
  'ctx.relatedArchitectureBlueprints.forEach',
  'ctx.relatedRelationships.forEach',
].every((item) => contextSrc.includes(item)));
assert('citation text has secret redaction', contextSrc.includes('safeCitationText') && contextSrc.includes('[REDACTED]'));

console.log('\nTEST 2: Controller response integration');
assert('controller imports ContextCitation type', controllerSrc.includes('ContextCitation'));
assert('legacy citations are normalized', controllerSrc.includes('normalizeLegacyCitations'));
assert('context and legacy citations are merged', controllerSrc.includes('mergeCitations'));
assert('chat response returns citations', chatHandler.includes('citations: responseCitations'));
assert('multi-agent chat response returns citations', chatHandler.includes('answers: newReplies') && chatHandler.includes('citations: responseCitations'));
assert('explain response keeps explanation and adds optional citations', explainHandler.includes('explanation,') && explainHandler.includes('citations: explainCitations'));
assert('chat/explain old response fields remain', controllerSrc.includes('sessionId: session._id') && controllerSrc.includes('answer,') && controllerSrc.includes('return res.status(200).json({') && explainHandler.includes('explanation'));

console.log('\nTEST 3: No full code in citation payloads');
assert('legacy citation type excludes code', controllerSrc.includes('citations: { fileName: string; path: string; score: number }[]'));
assert('controller no longer returns code on citation objects', ![
  'code: c.code',
  'code: c.content',
  'code: entity.code',
  'code: c.content.substring',
].some((needle) => controllerSrc.includes(needle)));
assert('ChatSession citation schema has no code field', !chatSessionSrc.includes('code: { type: String }'));
assert('ContextCitation has no content field', !/content\??:/.test(contextCitationInterface));
assert('buildCitations does not copy memory content', !/ctx\.relevantMemory\.forEach[\s\S]*memory\.content/.test(contextSrc));
assert('buildCitations does not copy raw search content', !/ctx\.relatedSearchResults\.forEach[\s\S]*(contentPreview|result\.content)/.test(contextSrc));

console.log('\nTEST 4: Chat UI renders citations conditionally');
assert('chat Citation interface includes normalized fields', chatPageSrc.includes('domainType?: string') && chatPageSrc.includes('source?:'));
assert('chat UI checks citations before rendering', chatPageSrc.includes('m.citations && m.citations.length > 0'));
assert('chat UI renders citation title', chatPageSrc.includes('citationTitle(c)'));
assert('chat UI renders domain/type badge', chatPageSrc.includes('humanizeCitationLabel(c.domainType || c.type || c.source)'));
assert('chat UI renders path if available', chatPageSrc.includes('c.path &&'));
assert('chat UI renders confidence if available', chatPageSrc.includes('citationConfidence(c)'));
assert('chat UI renders relationship type if available', chatPageSrc.includes('c.relationshipType') && chatPageSrc.includes('humanizeRelationshipType(c.relationshipType)'));

console.log('\nTEST 5: Project explain UI renders citations conditionally');
assert('project page Citation interface includes normalized fields', projectPageSrc.includes('interface Citation') && projectPageSrc.includes('domainType?: string'));
assert('project explain stores citations from response', projectPageSrc.includes('setExplanationCitations(Array.isArray(data.citations) ? data.citations : [])'));
assert('project page has renderCitations helper', projectPageSrc.includes('const renderCitations = (citations?: Citation[])'));
assert('project explain panel renders citations', projectPageSrc.includes('renderCitations(explanationCitations)'));
assert('project chat renders citations conditionally', projectPageSrc.includes("m.sender === 'assistant' && renderCitations(m.citations)"));
assert('project citation UI renders safe metadata', [
  'citationTitle(citation)',
  'citation.path',
  'citationConfidence(citation)',
  'humanizeCitationLabel(citation.domainType || citation.type || citation.source)',
  'citation.relationshipType',
].every((item) => projectPageSrc.includes(item)));

console.log('\nTEST 6: Builds');
run('backend build passes', 'npm run build', BACKEND);
run('frontend build passes', 'npm run build', FRONTEND);

console.log('\nRESULTS');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) process.exit(1);
process.exit(0);
