const fs = require('fs');
const path = require('path');

let failed = false;
const page = fs.readFileSync(path.join(__dirname, 'frontend/src/app/projects/page.tsx'), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== UPLOAD FRONTEND STATES VERIFICATION ===\n');

check('upload has selected file state', page.includes('selectedFile') && page.includes('setSelectedFile'));
check('upload has visible error state', page.includes('uploadError') && page.includes('AlertTriangle'));
check('upload rejects unsupported files client-side', page.includes('supportedFormatZip') && page.includes('!isZip'));
check('upload rejects oversized files client-side', page.includes('MAX_ZIP_SIZE') && page.includes('ZIP is too large'));
check('upload button disabled during active upload', page.includes('disabled={uploading || !selectedFile}'));
check('processing progress card exists', page.includes('Live Processing progress card') && page.includes('activeJob'));
check('partial success warning state exists', page.includes('Indexing completed with warnings'));
check('failed processing state exists', page.includes('Project indexing failed') && page.includes('errorCode'));
check('stale processing timeout/refetch exists', page.includes('No processing update received recently') && page.includes('fetchProjects();'));
check('refresh-safe processing project recovery exists', page.includes('processingProject') && page.includes('setActiveJob'));
check('socket payload is guarded by project id', page.includes('eventProjectId !== projectId'));

if (failed) process.exit(1);
console.log('\n[PASS] Upload frontend states verification passed.');
