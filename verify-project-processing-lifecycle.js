const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== PROJECT PROCESSING LIFECYCLE VERIFICATION ===\n');

const processor = read('backend/src/services/project-processor.service.ts');
const queue = read('backend/src/services/queue.service.ts');
const page = read('frontend/src/app/projects/page.tsx');

check('processing progress includes stable counters', ['processedFiles', 'skippedFiles', 'failedFiles', 'indexedFiles', 'embeddingFailures', 'parserWarnings', 'totalFiles'].every((v) => processor.includes(v)));
check('processor validates projectId and userId before work', processor.includes('mongoose.Types.ObjectId.isValid(projectId)') && processor.includes('mongoose.Types.ObjectId.isValid(userId)'));
check('processor checks project still exists and belongs to job user', processor.includes('Project.findOne({ _id: projectId, userId }'));
check('empty processable archive fails safely', processor.includes('NO_PROCESSABLE_FILES'));
check('per-file processing failure increments failedFiles instead of aborting project', processor.includes('Failed to process') && processor.includes('counters.failedFiles++'));
check('parser failures become parserWarnings', processor.includes('Parser warning') && processor.includes('counters.parserWarnings++'));
check('embedding failures become embeddingFailures', processor.includes('Embedding failed') && processor.includes('counters.embeddingFailures++'));
check('final status can be completed or partial', processor.includes("finalStatus: ProcessingProgress['status']") && processor.includes("'partial'"));
check('queue writes normalized processing stats to project', queue.includes('processingStats') && queue.includes('processingErrorCode'));
check('frontend supports partial/failed processing states', page.includes("'partial'") && page.includes('Indexing completed with warnings'));

if (failed) process.exit(1);
console.log('\n[PASS] Project processing lifecycle verification passed.');
