const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== PLAN LIMIT ENFORCEMENT VERIFICATION ===\n');

const routes = read('backend/src/routes/project.routes.ts') + '\n' + read('backend/src/routes/ai.routes.ts');
const limits = read('backend/src/middleware/limits.ts');
const project = read('backend/src/controllers/project.controller.ts');
const billing = read('backend/src/utils/billing.ts');
const workspace = read('backend/src/controllers/workspace.controller.ts');
const limitCatchBlock = limits.slice(limits.indexOf('} catch'));

check('project upload route is protected by project limit middleware', routes.includes("checkPlanLimits('project')"));
check('AI chat/explain routes are protected by AI question limit middleware', routes.includes("checkPlanLimits('aiQuestions')"));
check('limit middleware uses shared subscription payload', limits.includes('buildSubscriptionPayload(userId)'));
check('project count limit checks current usage against canonical limit', limits.includes('payload.usage.projectsCount >= payload.limits.projectsCount'));
check('AI question limit checks current usage against canonical limit', limits.includes('payload.usage.aiQuestionsUsed >= payload.limits.aiQuestionsPerMonth'));
check('limit middleware fails closed on unexpected errors', limits.includes('PLAN_LIMIT_CHECK_FAILED') && !limitCatchBlock.includes('return next()'));
check('storage upload uses subscription payload limit', project.includes('buildSubscriptionPayload(req.user.id)') && project.includes('subscriptionPayload.limits.storageBytes'));
check('storage limit response includes current, requested, remaining', project.includes('current: currentStorage') && project.includes('requested: expandedBytes') && project.includes('remaining: subscriptionPayload.remaining.storageBytes'));
check('team member limit exists in canonical billing limits', billing.includes('teamMembers') && billing.includes('usage.teamMembers'));
check('workspace member add enforces team member limit', workspace.includes('workspace.members.length >= billing.limits.teamMembers') && workspace.includes("resource: 'teamMembers'"));

if (failed) process.exit(1);
console.log('\n[PASS] Plan limit enforcement verification passed.');
