const fs = require('fs');
const path = require('path');

console.log('=== DEVVAULT AI: DOMAIN MODEL SAFETY & ALIGNMENT VERIFICATION ===\n');

// 1. Static checks
const checks = [
  {
    name: 'Domain mapper utility file existence',
    path: path.join(__dirname, 'backend/src/utils/domain-mapper.ts'),
    verify: (content) => content.includes('domainVocabulary') && content.includes('decorateObject')
  },
  {
    name: 'Global Express API Response Decorator injection & safety checks',
    path: path.join(__dirname, 'backend/src/index.ts'),
    verify: (content) =>
      content.includes('decorateObject') &&
      content.includes('skipDecoration') &&
      content.includes('req.path.startsWith') &&
      content.includes('normalizeSocketProjectId') &&
      content.includes('mongoose.Types.ObjectId.isValid')
  },
  {
    name: 'Alias routes mount (/codebases mapped to projectRoutes)',
    path: path.join(__dirname, 'backend/src/routes/index.ts'),
    verify: (content) => content.includes("router.use('/codebases', projectRoutes);")
  },
  {
    name: 'Frontend Localization Mixed Labels',
    path: path.join(__dirname, 'frontend/src/context/LanguageContext.tsx'),
    verify: (content) => 
      content.includes("projects: 'Codebases (Projects)'") && 
      content.includes("snippets: 'Code Assets (Snippets)'") &&
      content.includes("errors: 'Debugging Lessons (Errors)'")
  },
  {
    name: 'Domain documentation presence',
    path: path.join(__dirname, 'docs/domain-model.md'),
    verify: (content) => content.includes('DOMAIN TERMINOLOGY & ARCHITECTURE MAPPING') && content.includes('SAFETY & CLEANUP WARNINGS')
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

// 2. Programmatic tests against compiled build
console.log('\n--- Running programmatic tests on domain decorator ---');
const distMapperPath = path.join(__dirname, 'backend/dist/utils/domain-mapper.js');
if (!fs.existsSync(distMapperPath)) {
  console.log('[❌] Programmatic tests failed: compiled file backend/dist/utils/domain-mapper.js not found. Please compile backend first.');
  failed = true;
} else {
  try {
    const { decorateObject } = require(distMapperPath);
    
    // Test cases
    const testCases = [
      {
        name: 'Should decorate Project codebase',
        input: { _id: '123', name: 'my-project', userId: 'usr-1', processingStatus: 'completed', healthScore: 95 },
        expected: (out) => out.domainType === 'codebase'
      },
      {
        name: 'Should decorate File source asset',
        input: { _id: 'file-1', path: 'src/index.ts', extension: 'ts', size: 1024 },
        expected: (out) => out.domainType === 'source_asset'
      },
      {
        name: 'Should NOT decorate Auth Token response',
        input: { accessToken: 'jwt-token-xyz', user: { name: 'admin' } },
        expected: (out) => out.domainType === undefined && out.user.domainType === undefined
      },
      {
        name: 'Should NOT decorate API Error response',
        input: { error: 'Invalid verification code.' },
        expected: (out) => out.domainType === undefined
      },
      {
        name: 'Should NOT decorate generic objects without identifiers',
        input: { title: 'Random Object', data: 42 },
        expected: (out) => out.domainType === undefined
      },
      {
        name: 'Should recursively decorate nested lists and objects',
        input: {
          projects: [
            { _id: 'p1', name: 'proj1', userId: 'u1', processingStatus: 'completed', healthScore: 80 },
            { _id: 'p2', name: 'proj2', userId: 'u1', processingStatus: 'completed', healthScore: 90 }
          ],
          metadata: { total: 2 }
        },
        expected: (out) => 
          out.projects[0].domainType === 'codebase' && 
          out.projects[1].domainType === 'codebase' && 
          out.metadata.domainType === undefined
      },
      {
        name: 'Should preserve ObjectId-like buffer as hex string',
        input: {
          _id: {
            buffer: {
              '0': 106,
              '1': 58,
              '2': 70,
              '3': 35,
              '4': 205,
              '5': 42,
              '6': 133,
              '7': 88,
              '8': 31,
              '9': 151,
              '10': 215,
              '11': 165
            }
          },
          name: 'proj1',
          userId: 'u1',
          processingStatus: 'completed',
          healthScore: 80
        },
        expected: (out) => out._id === '6a3a4623cd2a85581f97d7a5' && out.domainType === 'codebase'
      },
      {
        name: 'Should serialize Date values as ISO strings',
        input: { _id: 'p1', name: 'proj1', userId: 'u1', processingStatus: 'completed', healthScore: 80, createdAt: new Date('2026-07-02T10:20:30.000Z') },
        expected: (out) => out.createdAt === '2026-07-02T10:20:30.000Z' && out.domainType === 'codebase'
      },
      {
        name: 'Should serialize Buffer values without expanding numeric keys',
        input: { payload: Buffer.from('safe-buffer') },
        expected: (out) => typeof out.payload === 'string' && out.payload === Buffer.from('safe-buffer').toString('base64')
      }
    ];

    testCases.forEach(tc => {
      const output = decorateObject(tc.input);
      if (tc.expected(output)) {
        console.log(`[✅] Test passed: ${tc.name}`);
      } else {
        console.log(`[❌] Test failed: ${tc.name}. Output:`, JSON.stringify(output));
        failed = true;
      }
    });
  } catch (err) {
    console.log(`[❌] Programmatic tests failed with exception: ${err.message}`);
    failed = true;
  }
}

if (failed) {
  console.log('\n[❌] Safety verification failed.');
  process.exit(1);
} else {
  console.log('\n[✅] All alignment and safety validation checks passed successfully!');
  process.exit(0);
}
