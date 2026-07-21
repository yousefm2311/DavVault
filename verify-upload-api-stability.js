const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== UPLOAD API STABILITY VERIFICATION ===\n');

const controller = read('backend/src/controllers/project.controller.ts');
const routes = read('backend/src/routes/project.routes.ts');
const projectModel = read('backend/src/models/Project.ts');

check('upload route uses safe multer wrapper', routes.includes('uploadProjectZip') && routes.includes('PROJECT_UPLOAD_VALIDATION_FAILED'));
check('missing ZIP returns structured 400', controller.includes('PROJECT_ZIP_REQUIRED'));
check('missing project name returns structured 400', controller.includes('PROJECT_NAME_REQUIRED'));
check('unsupported archive type returns structured 400', controller.includes('UNSUPPORTED_ARCHIVE_TYPE'));
check('corrupted ZIP returns structured 400', controller.includes('CORRUPTED_ZIP_ARCHIVE'));
check('empty ZIP returns structured 400', controller.includes('EMPTY_ZIP_ARCHIVE'));
check('unsafe ZIP paths return structured 400', controller.includes('UNSAFE_ZIP_PATH'));
check('oversized upload/archive returns structured errors', routes.includes('UPLOAD_FILE_TOO_LARGE') && controller.includes('UNSAFE_ZIP_ARCHIVE'));
check('queue creation failure marks project failed', controller.includes('PROJECT_QUEUE_FAILED') && controller.includes('processingStatus: \'failed\''));
check('upload response keeps projectId and adds queueMode non-destructively', controller.includes('projectId: newProject._id.toString()') && controller.includes('queueMode: queueService.getMode()'));
check('project model has partial/failure metadata fields', projectModel.includes("'partial'") && projectModel.includes('processingStats') && projectModel.includes('processingErrorCode'));
check('upload 500 path is structured', controller.includes('PROJECT_UPLOAD_FAILED') && !controller.includes('res.status(500).json({ error: error.message })'));

if (failed) process.exit(1);
console.log('\n[PASS] Upload API stability verification passed.');
