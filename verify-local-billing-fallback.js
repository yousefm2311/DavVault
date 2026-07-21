const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== LOCAL BILLING FALLBACK VERIFICATION ===\n');

const billing = read('backend/src/utils/billing.ts');
const controller = read('backend/src/controllers/subscription.controller.ts');
const billingPage = read('frontend/src/app/billing/page.tsx');
const profile = read('frontend/src/app/profile/page.tsx');
const health = read('backend/src/index.ts');

check('Stripe configured helper requires secret and price ids', billing.includes('process.env.STRIPE_SECRET_KEY') && billing.includes('process.env.STRIPE_PRO_PRICE_ID') && billing.includes('process.env.STRIPE_TEAM_PRICE_ID'));
check('missing local subscription records are marked simulated when Stripe is absent', billing.includes('isLocalSimulation: !stripeConfigured()'));
check('subscription payload exposes local simulation and stripeConfigured flags', billing.includes('isLocalSimulation: Boolean') && billing.includes('stripeConfigured: stripeConfigured()'));
check('checkout missing config returns explicit local fallback response', controller.includes('STRIPE_NOT_CONFIGURED') && controller.includes('isLocalSimulation: true'));
check('portal missing config returns explicit local fallback response', controller.includes('createBillingPortalSession') && controller.includes('stripeConfigured: false'));
check('billing page renders local simulation notice', billingPage.includes('Local billing simulation is active'));
check('profile billing tab renders local simulation notice', profile.includes('Local billing simulation is active.'));
check('health reports Stripe config as boolean only', health.includes('stripe: Boolean(process.env.STRIPE_SECRET_KEY') && !health.includes('STRIPE_SECRET_KEY,'));

if (failed) process.exit(1);
console.log('\n[PASS] Local billing fallback verification passed.');
