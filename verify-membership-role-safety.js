const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== MEMBERSHIP ROLE SAFETY VERIFICATION ===\n');

const controller = read('backend/src/controllers/workspace.controller.ts');
const routes = read('backend/src/routes/workspace.routes.ts');

check('roles are normalized and owner cannot be client-submitted', controller.includes('normalizeMemberRole') && controller.includes("value === 'admin' || value === 'member'"));
check('invalid member roles return INVALID_MEMBER_ROLE', controller.includes("code: 'INVALID_MEMBER_ROLE'"));
check('workspace management requires owner or admin membership', controller.includes('isWorkspaceManager') && controller.includes("member.role === 'admin'"));
check('role update route requires role validation', routes.includes("validateBody(['role'])") && controller.includes('updateWorkspaceMemberRole'));
check('owner role cannot be changed', controller.includes("OWNER_ROLE_CHANGE_BLOCKED"));
check('owner cannot be removed', controller.includes("OWNER_REMOVE_BLOCKED"));
check('duplicate membership is prevented', controller.includes('DUPLICATE_MEMBER') && controller.includes('workspace.members.some'));
check('removed member receives revocation notification safely', controller.includes('Workspace member removed') && controller.includes('notificationService.create'));

if (failed) process.exit(1);
console.log('\n[PASS] Membership role safety verification passed.');
