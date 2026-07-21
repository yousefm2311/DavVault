const fs = require('fs');
const path = require('path');

console.log('=== DEVVAULT AI: SEARCH ENGINE STABILIZATION VERIFICATION ===\n');

// 1. Static file check
const checks = [
  {
    name: 'Search service file existence',
    path: path.join(__dirname, 'backend/src/services/search.service.ts'),
    verify: (content) => content.includes('SearchService') && content.includes('reusableSystem')
  },
  {
    name: 'Search controller delegation to SearchService',
    path: path.join(__dirname, 'backend/src/controllers/search.controller.ts'),
    verify: (content) => content.includes('searchService.search') && !content.includes('calculateCosineSimilarity')
  },
  {
    name: 'Search routing endpoint presence',
    path: path.join(__dirname, 'backend/src/routes/search.routes.ts'),
    verify: (content) => content.includes("router.post('/',") && content.includes('searchHybrid')
  },
  {
    name: 'Candidate limit env support',
    path: path.join(__dirname, 'backend/src/services/search.service.ts'),
    verify: (content) => content.includes('SEARCH_EMBEDDING_CANDIDATE_LIMIT')
  }
];

let failed = false;

checks.forEach(check => {
  try {
    if (!fs.existsSync(check.path)) {
      console.log(`[❌] ${check.name} failed: File not found at ${check.path}`);
      failed = true;
      return;
    }
    const content = fs.readFileSync(check.path, 'utf8');
    if (check.verify(content)) {
      console.log(`[✅] ${check.name} passed.`);
    } else {
      console.log(`[❌] ${check.name} failed: Content assertion failed.`);
      failed = true;
    }
  } catch (err) {
    console.log(`[❌] ${check.name} failed with error: ${err.message}`);
    failed = true;
  }
});

// 2. Programmatic checks against compiled code
console.log('\n--- Running programmatic tests on Search Service ---');
const distServicePath = path.join(__dirname, 'backend/dist/services/search.service.js');
if (!fs.existsSync(distServicePath)) {
  console.log('[❌] Programmatic tests failed: compiled file backend/dist/services/search.service.js not found. Please compile backend first.');
  failed = true;
} else {
  try {
    // Basic verification of export structure
    const searchModule = require(distServicePath);
    if (searchModule && searchModule.searchService && typeof searchModule.searchService.search === 'function') {
      console.log('[✅] searchService.search is exported and is a valid function.');
    } else {
      console.log('[❌] searchService.search export validation failed.');
      failed = true;
    }
  } catch (err) {
    console.log(`[❌] Programmatic tests failed with error: ${err.message}`);
    failed = true;
  }
}

if (failed) {
  console.log('\n[❌] Verification failed.');
  process.exit(1);
} else {
  console.log('\n[✅] All search engine stabilization checks passed successfully!');
  process.exit(0);
}
