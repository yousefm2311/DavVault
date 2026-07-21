const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== UPLOAD ZIP SAFETY VERIFICATION ===\n');

const controller = read('backend/src/controllers/project.controller.ts');
const processor = read('backend/src/services/project-processor.service.ts');
const security = read('backend/src/middleware/security.ts');

check('controller blocks unsafe paths before queueing', controller.includes('hasUnsafePath') && controller.includes('UNSAFE_ZIP_PATH'));
check('controller caps archive entries/expanded bytes/file bytes', controller.includes('maxEntries') && controller.includes('maxExpandedBytes') && controller.includes('maxFileBytes'));
check('processor normalizes ZIP paths', processor.includes('normalizeZipPath') && processor.includes('path.posix.normalize'));
check('processor skips path traversal entries', processor.includes('Skipped unsafe archive path') && processor.includes("normalized.includes('..')"));
check('processor filters ignored folders and gitignore rules', processor.includes('ignoredFolders') && processor.includes('ig.ignores(normalizedPath)'));
check('processor skips unsupported extensions', processor.includes('supportedExtensions') && processor.includes('skippedFiles++'));
check('processor detects binary files', processor.includes('isProbablyBinary') && processor.includes('sample.includes(0)'));
check('processor handles duplicate file paths deterministically', processor.includes('seenPaths') && processor.includes('Skipped duplicate file path'));
check('processor handles unreadable files per-file', processor.includes('Could not read') && processor.includes('failedFiles++'));
check('safePathResolve uses path.relative containment check', security.includes('path.relative') && security.includes("relative.startsWith('..')"));

if (failed) process.exit(1);
console.log('\n[PASS] Upload ZIP safety verification passed.');
