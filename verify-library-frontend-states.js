const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== LIBRARY FRONTEND STATES VERIFICATION ===\n');

const snippets = read('frontend/src/app/snippets/page.tsx');
const errors = read('frontend/src/app/errors/page.tsx');
const systems = read('frontend/src/app/systems/page.tsx');

check('snippets page has loading/error/empty states', snippets.includes('loadingSnippets') && snippets.includes('snippetsError') && snippets.includes('noSnippetsText'));
check('errors page has loading/error/empty states', errors.includes('loadingErrors') && errors.includes('errorsError') && errors.includes('noErrorsText'));
check('systems page has loading/error/empty states', systems.includes('loadingSystems') && systems.includes('systemsError') && systems.includes('noSystemsText'));
check('source library pages validate citation/query ids', snippets.includes('isValidObjectIdString(urlId)') && errors.includes('isValidObjectIdString(urlId)') && systems.includes('isValidObjectIdString(requestedId)'));
check('source library pages have retry actions', snippets.includes('onClick={fetchSnippets}') && errors.includes('onClick={fetchData}') && systems.includes('onClick={fetchSystems}'));
check('source library create actions disable while submitting', snippets.includes('disabled={submitting}') && errors.includes('disabled={submitting}') && systems.includes('disabled={submitting}'));
check('source library delete actions disable while deleting', snippets.includes('deletingId') && errors.includes('deletingId') && systems.includes('deletingId'));
check('frontend failures are visible, not console-only', snippets.includes('setSnippetsError') && errors.includes('setErrorsError') && systems.includes('setSystemsError'));

if (failed) process.exit(1);
console.log('\n[PASS] Library frontend states verification passed.');
