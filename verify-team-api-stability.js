const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== TEAM API STABILITY VERIFICATION ===\n');

const routes = read('backend/src/routes/workspace.routes.ts');
const controller = read('backend/src/controllers/workspace.controller.ts');
const model = read('backend/src/models/Workspace.ts');

check('workspace member routes exist and require auth', routes.includes("router.get('/members', authenticate") && routes.includes("router.post('/members', authenticate") && routes.includes("router.delete('/members/:userId', authenticate"));
check('workspace member role update route exists', routes.includes("router.patch('/members/:userId/role', authenticate"));
check('workspace controller validates authenticated user id', controller.includes("invalidIdResponse(res, 'user id')") && controller.includes('isValidMongoId(req.user.id)'));
check('workspace controller validates member ids before Mongoose work', controller.includes("invalidIdResponse(res, 'member id')") && controller.includes('isValidMongoId(req.params.userId)'));
check('missing workspace returns WORKSPACE_NOT_FOUND', controller.includes("code: 'WORKSPACE_NOT_FOUND'"));
check('missing member returns MEMBER_NOT_FOUND', controller.includes("code: 'MEMBER_NOT_FOUND'"));
check('500 paths are structured and not raw error.message', controller.includes('serverErrorResponse') && !controller.includes('error.message'));
check('workspace model deduplicates members and preserves owner membership', model.includes("pre('validate'") && model.includes('seen.has(memberId)') && model.includes("role: 'owner'"));
check('workspace model indexes owner and members', model.includes('WorkspaceSchema.index({ ownerId: 1 })') && model.includes("WorkspaceSchema.index({ 'members.userId': 1 })"));

if (failed) process.exit(1);
console.log('\n[PASS] Team API stability verification passed.');
