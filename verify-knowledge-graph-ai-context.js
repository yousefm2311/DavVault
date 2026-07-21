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
const aiServicePath = path.join(BACKEND, 'src', 'services', 'ai.service.ts');
const aiControllerPath = path.join(BACKEND, 'src', 'controllers', 'ai.controller.ts');
const backendPackagePath = path.join(BACKEND, 'package.json');
const frontendPackagePath = path.join(FRONTEND, 'package.json');

console.log('\nKnowledge Graph AI Context verification');
console.log('=======================================');

const contextSrc = read(contextPath);
const aiServiceSrc = read(aiServicePath);
const aiControllerSrc = read(aiControllerPath);

console.log('\nTEST 1: Backend build');
run('backend build passes', 'npm run build', BACKEND);

console.log('\nTEST 2: Context builder uses knowledge graph service');
assert('context builder imports knowledgeGraphService', contextSrc.includes('knowledgeGraphService'));
assert('context builder uses GraphRelationship type', contextSrc.includes('GraphRelationship'));
assert('AI_CONTEXT_MAX_RELATIONSHIPS is respected', contextSrc.includes('AI_CONTEXT_MAX_RELATIONSHIPS') && contextSrc.includes('MAX_RELATIONSHIPS'));
assert('graph failures are isolated as warnings', contextSrc.includes('Graph relationship warning'));

console.log('\nTEST 3: Chat relationship relevance filtering');
assert('chat context fetches project graph neighborhood', contextSrc.includes("entityType: 'codebase'") && contextSrc.includes('depth: 2'));
assert('chat context ranks relationships by user message', contextSrc.includes('rankRelationshipsForQuery') && contextSrc.includes('relationshipRelevanceScore'));
assert('relevance checks display names and paths', [
  'displayName',
  'sourceDisplayName',
  'targetDisplayName',
  'sourcePath',
  'targetPath',
].every((field) => contextSrc.includes(field)));
assert('relevance checks evidence and relationship type', [
  'relationship.evidence?.reason',
  'relationship.evidence?.snippet',
  'relationship.relationshipType',
].every((field) => contextSrc.includes(field)));
assert('chat relationship count is capped', contextSrc.includes('.slice(0, MAX_RELATIONSHIPS)'));

console.log('\nTEST 4: Explain-code direct relationships');
assert('explain-code fetches source asset neighborhood', contextSrc.includes("entityType: 'source_asset'") && contextSrc.includes('fileId'));
assert('explain-code includes incoming and outgoing relationships', contextSrc.includes('...neighborhood.outgoing') && contextSrc.includes('...neighborhood.incoming'));
assert('explain-code prefers requested relationship types', [
  "'defines'",
  "'imports'",
  "'calls'",
  "'depends_on'",
  "'documents'",
  "'solves'",
  'prioritizeExplainRelationships',
].every((item) => contextSrc.includes(item)));

console.log('\nTEST 5: Relationship summary');
assert('context summary includes relationship count', contextSrc.includes('knowledge graph relationship(s)'));
assert('context summary includes common relationship types', contextSrc.includes('common types'));
assert('context summary includes connected entities', contextSrc.includes('connected entities'));
assert('summary uses display labels when available', contextSrc.includes('relationship.displayType') && contextSrc.includes('relationship.sourceDisplayName'));

console.log('\nTEST 6: AI prompt integration');
assert('AI service formats relationship context', aiServiceSrc.includes('formatKnowledgeRelationships'));
assert('prompt includes Knowledge Relationships section', aiServiceSrc.includes('Knowledge Relationships:'));
assert('prompt tells AI to explain file/entity connections', aiServiceSrc.includes('explain how files/entities connect'));
assert('prompt forbids invented relationships', aiServiceSrc.includes('Do not invent relationships'));
assert('prompt handles incomplete relationships', aiServiceSrc.includes('relationships are incomplete'));
assert('prompt prefers direct evidence', aiServiceSrc.includes('Prefer direct evidence over inferred links'));
assert('relationship formatter includes confidence and evidence', aiServiceSrc.includes('Confidence:') && aiServiceSrc.includes('Evidence:'));

console.log('\nTEST 7: Chat/explain response shapes unchanged');
assert('chat response still returns sessionId/title/answer/citations', [
  'sessionId: session._id',
  'title: session.title',
  'answer',
  'citations:',
].every((item) => aiControllerSrc.includes(item)));
assert('multi-agent chat response shape remains', aiControllerSrc.includes('answers: newReplies') && aiControllerSrc.includes('answer: newReplies[newReplies.length - 1].text'));
assert('explain-code response still returns explanation and only additive citations', aiControllerSrc.includes('explanation,') && aiControllerSrc.includes('citations: explainCitations'));
assert('controller does not add relationship fields to responses', !aiControllerSrc.includes('relatedRelationships: enrichedContext'));

console.log('\nTEST 8: Frontend untouched by Phase 8');
const frontendFiles = [];
function collectFrontendFiles(dir) {
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!['node_modules', '.next', 'dist', 'build'].includes(item)) collectFrontendFiles(fullPath);
    } else if (/\.(ts|tsx|js|jsx)$/.test(item)) {
      frontendFiles.push(fullPath);
    }
  }
}
collectFrontendFiles(path.join(FRONTEND, 'src'));
const frontendCombined = frontendFiles.map(read).join('\n');
assert('frontend does not import AI context builder', !frontendCombined.includes('ai-context-builder'));
assert('frontend does not reference Phase 8 backend limits', !frontendCombined.includes('AI_CONTEXT_MAX_RELATIONSHIPS'));
assert('frontend does not call new AI context endpoint', !frontendCombined.includes('knowledge-graph-ai-context'));

console.log('\nTEST 9: No prohibited infrastructure dependencies');
const deps = {
  ...(JSON.parse(read(backendPackagePath)).dependencies || {}),
  ...(JSON.parse(read(backendPackagePath)).devDependencies || {}),
  ...(JSON.parse(read(frontendPackagePath)).dependencies || {}),
  ...(JSON.parse(read(frontendPackagePath)).devDependencies || {}),
};
assert('no qdrant dependency', !deps.qdrant && !deps['@qdrant/js-client-rest']);
assert('no neo4j dependency', !deps['neo4j-driver']);
assert('no S3 SDK dependency', !deps['aws-sdk'] && !deps['@aws-sdk/client-s3']);
assert('no Kafka/Event Bus dependency', !deps.kafka && !deps['kafka-node'] && !deps.kafkajs);
assert('context files do not import prohibited infrastructure', !/(qdrant|neo4j|aws-sdk|@aws-sdk|kafkajs|kafka-node)/i.test([
  contextSrc,
  aiServiceSrc,
].join('\n')));

console.log('\nRESULTS');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) process.exit(1);
process.exit(0);
