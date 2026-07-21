const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== ADMIN PLAN CONTROL SAFETY VERIFICATION ===\n');

const routes = read('backend/src/routes/admin.routes.ts');
const controller = read('backend/src/controllers/admin.controller.ts');

check('admin routes require authenticate and admin middleware', routes.includes('router.use(authenticate, isAdmin)'));
check('plan limit updates require superadmin', routes.includes("router.put('/settings/limits', isSuperAdmin, updatePlanLimits)"));
check('admin object ids are validated before Mongoose calls', controller.includes('isValidAdminObjectId') && controller.includes("invalidObjectIdResponse(res, 'user id')") && controller.includes("invalidObjectIdResponse(res, 'project id')"));
check('plan limit payload validates known plans and numeric limits', controller.includes('normalizePlanLimits') && controller.includes('isBillablePlan(plan)') && controller.includes('isSafePlanLimitValue'));
check('admin plan limit activity is auditable without raw large payload', controller.includes("action: 'admin_plan_limits_updated'") && controller.includes('metadata: { plans: Object.keys(normalizedLimits) }'));
check('admin errors are structured and not raw error.message', controller.includes('adminServerError') && !controller.includes('error: error.message'));
check('admin destructive project delete has safe missing project code', controller.includes("code: 'PROJECT_NOT_FOUND'"));

if (failed) process.exit(1);
console.log('\n[PASS] Admin plan control safety verification passed.');
