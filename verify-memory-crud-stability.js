const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== MEMORY CRUD STABILITY VERIFICATION ===\n');

const controller = read('backend/src/controllers/memory.controller.ts');
const routes = read('backend/src/routes/memory.routes.ts');
const service = read('backend/src/services/memory.service.ts');

check('memory CRUD routes exist and require auth', routes.includes("router.get('/',     authenticate, getMemories)") && routes.includes("router.get('/:id',    authenticate, getMemoryById)") && routes.includes("router.post('/',    authenticate, createMemory)") && routes.includes("router.patch('/:id',  authenticate, updateMemory)") && routes.includes("router.delete('/:id', authenticate, deleteMemory)"));
check('memory ids are validated before Mongoose updates/deletes/reads', controller.includes("invalidIdResponse(res, 'memoryId')") && controller.includes('isValidObjectIdString(id)'));
check('missing memory returns MEMORY_NOT_FOUND', controller.includes("code: 'MEMORY_NOT_FOUND'"));
check('memory 500 paths are structured and safe', controller.includes('serverErrorResponse') && !controller.includes('error.message'));
check('memory type/scope/source are validated', controller.includes('INVALID_MEMORY_TYPE') && controller.includes('INVALID_MEMORY_SCOPE') && controller.includes('INVALID_MEMORY_SOURCE'));
check('memory scope target requirements are enforced', controller.includes('PROJECT_SCOPE_REQUIRED') && controller.includes('WORKSPACE_SCOPE_REQUIRED') && controller.includes('INVALID_MEMORY_SCOPE_TARGET'));
check('memory confidence and tags are bounded', controller.includes('normalizeConfidence') && controller.includes('tags.slice(0, 20)'));
check('memory service rejects secrets and caps content', service.includes('SECRET_PATTERNS') && service.includes('safeContent = input.content.substring(0, 2000)'));
check('duplicate memory prevention exists', service.includes('Memory.findOne') && service.includes('title:    safeTitle') && service.includes('isActive: true'));

if (failed) process.exit(1);
console.log('\n[PASS] Memory CRUD stability verification passed.');
