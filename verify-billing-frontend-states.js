const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== BILLING FRONTEND STATES VERIFICATION ===\n');

const billing = read('frontend/src/app/billing/page.tsx');
const profile = read('frontend/src/app/profile/page.tsx');
const sidebar = read('frontend/src/components/Sidebar.tsx');

check('billing page fetches subscription and handles loading', billing.includes("apiFetch('/subscription')") && billing.includes('loadingData'));
check('billing page has visible fetch error and retry state', billing.includes('Retry billing data') && billing.includes('setError(err instanceof Error'));
check('billing page shows local simulation state', billing.includes('Local billing simulation is active') && billing.includes('isLocalSimulation'));
check('billing page shows non-active subscription state', billing.includes("status !== 'active'") && billing.includes('Subscription status:'));
check('checkout/portal buttons are disabled while loading', billing.includes('disabled={isCurrent || upgradingPlan !== null'));
check('usage percentages guard zero/missing limits', billing.includes('if (!Number.isFinite(limit) || limit <= 0) return 0'));
check('profile billing tab has retry/error state', profile.includes('subscriptionError') && profile.includes('Retry billing usage'));
check('sidebar storage visualizer handles subscription failure safely', sidebar.includes("apiFetch('/subscription')") && sidebar.includes('setStoragePercent(0)'));
check('sidebar plan badge can show backend effective plan', sidebar.includes('effectivePlan') && sidebar.includes('(effectivePlan || user.plan).toUpperCase()'));

if (failed) process.exit(1);
console.log('\n[PASS] Billing frontend states verification passed.');
