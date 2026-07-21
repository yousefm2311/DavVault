const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== PLAN STATE CONSISTENCY VERIFICATION ===\n');

const billing = read('backend/src/utils/billing.ts');
const controller = read('backend/src/controllers/subscription.controller.ts');
const model = read('backend/src/models/Subscription.ts');
const sidebar = read('frontend/src/components/Sidebar.tsx');
const profile = read('frontend/src/app/profile/page.tsx');

check('subscription has unique user plan state', model.includes('userId: { type: Schema.Types.ObjectId, ref: \'User\', required: true, unique: true }'));
check('all app plans have canonical limits', ['free', 'pro', 'team', 'enterprise'].every((plan) => billing.includes(`${plan}: {`)));
check('inactive Stripe statuses map to predictable effective free plan', billing.includes("return 'canceled'") && billing.includes("status === 'active' || status === 'trialing' ? plan : 'free'"));
check('subscription payload uses effective plan limits', billing.includes('const effectivePlan = effectivePlanForStatus') && billing.includes('const limits = planLimits[effectivePlan]'));
check('webhook updates user plan from effective plan', controller.includes('await User.findByIdAndUpdate(userId, { plan: effectivePlan })'));
check('local fallback is explicit and not real paid state', billing.includes('isLocalSimulation') && billing.includes('!stripeConfigured()'));
check('frontend plan badge can use backend effective plan', sidebar.includes('effectivePlan') && profile.includes('(subData?.plan || user.plan).toUpperCase()'));

if (failed) process.exit(1);
console.log('\n[PASS] Plan state consistency verification passed.');
