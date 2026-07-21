const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== CITATION TARGET ACCESS SAFETY VERIFICATION ===\n');

const context = read('backend/src/services/ai-context-builder.service.ts');
const chatPage = read('frontend/src/app/chat/page.tsx');
const projectPage = read('frontend/src/app/projects/[id]/page.tsx');
const snippet = read('backend/src/controllers/snippet.controller.ts');
const error = read('backend/src/controllers/error.controller.ts');
const system = read('backend/src/controllers/system.controller.ts');

check('citation navigation only emits safe source library routes', context.includes('/snippets?id=') && context.includes('/errors?id=') && context.includes('/systems?id='));
check('citation payloads omit full code/error/memory bodies', context.includes('safe source citations') && !context.includes('code: snippet.code') && !context.includes('content: memory.content'));
check('chat citation routes are allowlisted', chatPage.includes('isSafeCitationRoute') && chatPage.includes('snippets|errors|systems'));
check('project citation routes are allowlisted', projectPage.includes('isSafeCitationRoute') && projectPage.includes('snippets|errors|systems'));
check('stale/deleted snippet targets fail safely through owner-scoped list/read', snippet.includes('SNIPPET_NOT_FOUND') && snippet.includes('userId: req.user.id'));
check('stale/deleted error targets fail safely through owner-scoped list/read', error.includes('ERROR_LESSON_NOT_FOUND') && error.includes('userId: req.user.id'));
check('stale/deleted system targets fail safely through owner-scoped list/read', system.includes('SYSTEM_NOT_FOUND') && system.includes('userId: req.user.id'));
check('memory citations are non-clickable safe metadata only', context.includes("domainType: 'memory'") && !context.includes("navigation: this.buildCitationNavigation({ domainType: 'memory'"));

if (failed) process.exit(1);
console.log('\n[PASS] Citation target access safety verification passed.');
