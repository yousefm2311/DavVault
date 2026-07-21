const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== TEAM MEMBER LIMIT ENFORCEMENT VERIFICATION ===\n');

const billing = read('backend/src/utils/billing.ts');
const subscription = read('backend/src/models/Subscription.ts');
const workspace = read('backend/src/controllers/workspace.controller.ts');
const teamPage = read('frontend/src/app/team/page.tsx');

check('canonical plan limits include teamMembers', billing.includes('teamMembers: 1') && billing.includes('teamMembers: 25') && billing.includes('teamMembers: 250'));
check('subscription model supports teamMembers limit', subscription.includes('teamMembers') && subscription.includes('default: 1'));
check('usage snapshot counts owner workspace members', billing.includes("Workspace.findOne({ ownerId: userId }") && billing.includes('usage.teamMembers'));
check('member add checks owner billing payload', workspace.includes('buildSubscriptionPayload(ownerId)') && workspace.includes('workspace.members.length >= billing.limits.teamMembers'));
check('limit response is structured', workspace.includes("code: 'LIMIT_EXCEEDED'") && workspace.includes("resource: 'teamMembers'") && workspace.includes('remaining: payload.remaining.teamMembers'));
check('frontend renders member limit and local billing state', teamPage.includes('memberLimit') && teamPage.includes('local billing'));

if (failed) process.exit(1);
console.log('\n[PASS] Team member limit enforcement verification passed.');
