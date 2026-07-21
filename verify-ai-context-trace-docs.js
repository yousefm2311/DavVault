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

const ROOT = __dirname;
const docsPath = path.join(ROOT, 'docs', 'ai-context-trace.md');

console.log('\nAI Context Trace Docs verification');
console.log('==================================');

console.log('\nTEST 1: Documentation file');
assert('docs/ai-context-trace.md exists', fs.existsSync(docsPath));

const docs = fs.existsSync(docsPath) ? read(docsPath) : '';
const lower = docs.toLowerCase();

console.log('\nTEST 2: Endpoint and purpose');
assert('endpoint path is documented', docs.includes('/api/ai/debug/context-trace'));
assert('debug endpoint purpose is documented', lower.includes('inspect') && lower.includes('context builder'));
assert('why it exists is documented', lower.includes('why') || lower.includes('exists to debug'));
assert('when to use it is documented', lower.includes('use it locally when'));
assert('required auth is documented', lower.includes('authenticated'));

console.log('\nTEST 3: Environment and safety');
assert('AI_DEBUG_CONTEXT_TRACE env var documented', docs.includes('AI_DEBUG_CONTEXT_TRACE=true'));
assert('production disabled warning exists', lower.includes('disabled in production'));
assert('never expose publicly warning exists', lower.includes('never expose'));
assert('sanitized metadata warning exists', lower.includes('sanitized metadata only'));
assert('no code or prompt warning exists', lower.includes('full code contents') && lower.includes('raw prompts'));
assert('secret safety warning exists', lower.includes('access tokens') && lower.includes('api keys') && lower.includes('passwords'));

console.log('\nTEST 4: Sample requests');
assert('chat mode sample exists', docs.includes('"mode": "chat"') && docs.includes('"How does auth flow work?"'));
assert('chat sample includes projectId', docs.includes('"projectId": "PROJECT_ID"'));
assert('explain mode sample exists', docs.includes('"mode": "explain"') && docs.includes('"Explain this file"'));
assert('explain sample includes fileId', docs.includes('"fileId": "FILE_ID"'));
assert('POST method documented', docs.includes('POST /api/ai/debug/context-trace'));

console.log('\nTEST 5: Sample response safe shape');
assert('contextSummary included in response sample', docs.includes('"contextSummary"'));
assert('counts included in response sample', docs.includes('"counts"'));
assert('selectedRelationships included in response sample', docs.includes('"selectedRelationships"'));
assert('selectedMemory included in response sample', docs.includes('"selectedMemory"'));
assert('warnings included in response sample', docs.includes('"warnings"'));
assert('safe relationship fields are shown', [
  '"relationshipType"',
  '"sourceDisplayName"',
  '"targetDisplayName"',
  '"sourcePath"',
  '"targetPath"',
  '"confidence"',
  '"evidenceReason"',
].every((field) => docs.includes(field)));
assert('safe memory fields are shown', [
  '"type"',
  '"scope"',
  '"title"',
  '"confidence"',
].every((field) => docs.includes(field)));

console.log('\nTEST 6: Troubleshooting');
assert('403 troubleshooting exists', docs.includes('403') && lower.includes('production'));
assert('401 troubleshooting exists', docs.includes('401') && lower.includes('unauthenticated'));
assert('404 troubleshooting exists', docs.includes('404') && lower.includes('project or file'));
assert('empty relationships troubleshooting exists', lower.includes('empty relationships'));
assert('empty memory troubleshooting exists', lower.includes('empty memory'));

console.log('\nTEST 7: No secrets or fake tokens');
const forbiddenPatterns = [
  /\bBearer\s+[A-Za-z0-9._-]+/i,
  /\bsk-[A-Za-z0-9]{8,}/,
  /\bAIza[A-Za-z0-9_-]{8,}/,
  /\bpassword\s*[:=]\s*["']?[^"'\s]+/i,
  /\bapi[_-]?key\s*[:=]\s*["']?[^"'\s]+/i,
  /\btoken\s*[:=]\s*["']?[^"'\s]+/i,
  /process\.env\.[A-Z0-9_]+/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
assert('documentation contains no secret-looking values', !forbiddenPatterns.some((pattern) => pattern.test(docs)));
assert('documentation does not include Authorization header examples', !/Authorization\s*:/i.test(docs));
assert('documentation uses placeholder IDs only', docs.includes('PROJECT_ID') && docs.includes('FILE_ID') && !docs.includes('Bearer'));

console.log('\nRESULTS');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) process.exit(1);
process.exit(0);
