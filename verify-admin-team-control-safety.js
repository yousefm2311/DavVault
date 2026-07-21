const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== ADMIN TEAM CONTROL SAFETY VERIFICATION ===\n');

const adminRoutes = read('backend/src/routes/admin.routes.ts');
const admin = read('backend/src/controllers/admin.controller.ts');
const workspace = read('backend/src/controllers/workspace.controller.ts');
const adminPage = read('frontend/src/app/admin/page.tsx');

check('admin routes require authenticate and isAdmin', adminRoutes.includes('router.use(authenticate, isAdmin)'));
check('admin user/project ids are validated before Mongoose', admin.includes('isValidAdminObjectId') && admin.includes("invalidObjectIdResponse(res, 'user id')") && admin.includes("invalidObjectIdResponse(res, 'project id')"));
check('admin plan limit update remains superadmin-only', adminRoutes.includes("router.put('/settings/limits', isSuperAdmin, updatePlanLimits)"));
check('admin errors are structured', admin.includes('adminServerError') && !admin.includes('error: error.message'));
check('workspace team controls are separate from admin routes and require auth', workspace.includes('if (!req.user) return res.status(401)'));
check('admin frontend has visible error state', adminPage.includes('setError') && adminPage.includes('error &&'));

if (failed) process.exit(1);
console.log('\n[PASS] Admin team control safety verification passed.');
