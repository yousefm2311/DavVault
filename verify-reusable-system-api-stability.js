const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== REUSABLE SYSTEM API STABILITY VERIFICATION ===\n');

const controller = read('backend/src/controllers/system.controller.ts');
const routes = read('backend/src/routes/system.routes.ts');
const page = read('frontend/src/app/systems/page.tsx');

check('reusable system CRUD routes exist', ["router.post('/'", "router.get('/'", "router.get('/:id'", "router.delete('/:id'"].every((needle) => routes.includes(needle)));
check('system controller validates system ids', controller.includes("invalidIdResponse(res, 'systemId')") && controller.includes('isValidObjectIdString(req.params.id)'));
check('missing systems return safe 404 code', controller.includes('SYSTEM_NOT_FOUND'));
check('system 500 paths are structured', controller.includes('serverErrorResponse') && controller.includes('REUSABLE_SYSTEM_CREATE_FAILED') && controller.includes('REUSABLE_SYSTEM_LIST_FAILED'));
check('system controller avoids raw error.message 500 responses', !controller.includes('res.status(500).json({ error: error.message })'));
check('system list supports type/tag filters without response shape changes', controller.includes('filter.type') && controller.includes('filter.tags') && controller.includes('return res.status(200).json({ systems })'));
check('system read/delete remain user-owned', controller.includes('ReusableSystem.findOne({ _id: req.params.id, userId: req.user.id })') && controller.includes('ReusableSystem.findOneAndDelete({ _id: req.params.id, userId: req.user.id })'));
check('frontend system page has load/save/delete error state', page.includes('systemsError') && page.includes('Unable to load reusable systems.') && page.includes('Unable to save reusable system.') && page.includes('Unable to delete reusable system.'));
check('frontend system URL/delete ids are guarded', page.includes('isValidObjectIdString(requestedId)') && page.includes('isValidObjectIdString(id)'));

if (failed) {
  console.log('\n[FAIL] Reusable system API stability verification failed.');
  process.exit(1);
}

console.log('\n[PASS] Reusable system API stability verification passed.');
