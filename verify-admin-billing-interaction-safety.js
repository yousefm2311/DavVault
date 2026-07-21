const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== ADMIN BILLING INTERACTION SAFETY VERIFICATION ===\n');

const admin = read('backend/src/controllers/admin.controller.ts');
const billing = read('backend/src/utils/billing.ts');
const workspace = read('backend/src/controllers/workspace.controller.ts');

check('admin plan limit validation includes numeric ranges', admin.includes('isSafePlanLimitValue') && admin.includes('normalizePlanLimits'));
check('admin plan limit validation includes teamMembers fallback/validation', admin.includes('rawLimits.teamMembers') && admin.includes('planLimits[plan].teamMembers'));
check('admin plan limit changes are audited without raw payload', admin.includes("action: 'admin_plan_limits_updated'") && admin.includes('metadata: { plans: Object.keys(normalizedLimits) }'));
check('workspace member limit derives from billing owner plan', workspace.includes('const ownerId = workspace.ownerId.toString()') && workspace.includes('buildSubscriptionPayload(ownerId)'));
check('local billing fallback appears in member limit response', workspace.includes('isLocalSimulation: payload.isLocalSimulation'));
check('billing helper exposes effective plan state for member limits', billing.includes('effectivePlanForStatus') && billing.includes('limits.teamMembers'));

if (failed) process.exit(1);
console.log('\n[PASS] Admin billing interaction safety verification passed.');
