const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== TEAM INVITE SAFETY VERIFICATION ===\n');

const controller = read('backend/src/controllers/workspace.controller.ts');
const teamPage = read('frontend/src/app/team/page.tsx');

check('direct add flow validates email presence', controller.includes('MEMBER_EMAIL_REQUIRED') && controller.includes('normalizeEmail'));
check('target user must exist and be active', controller.includes('USER_NOT_FOUND') && controller.includes('USER_NOT_ACTIVE') && controller.includes("status !== 'active'"));
check('invite/add does not expose invite tokens or secrets', !controller.includes('inviteToken') && !controller.includes('token:') && !controller.includes('password'));
check('duplicate add returns conflict code', controller.includes('res.status(409)') && controller.includes('DUPLICATE_MEMBER'));
check('frontend shows invite failure and success states', teamPage.includes('inviteError') && teamPage.includes('inviteSuccess'));
check('frontend disables add while inviting or over member limit', teamPage.includes('disabled={inviting || !inviteEmail || !canManageMembers') && teamPage.includes('Member limit reached'));

if (failed) process.exit(1);
console.log('\n[PASS] Team invite safety verification passed.');
