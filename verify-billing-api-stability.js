const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== BILLING API STABILITY VERIFICATION ===\n');

const controller = read('backend/src/controllers/subscription.controller.ts');
const routes = read('backend/src/routes/subscription.routes.ts');
const billing = read('backend/src/utils/billing.ts');
const model = read('backend/src/models/Subscription.ts');

check('subscription routes require auth', routes.includes("router.get('/', authenticate, getSubscription)") && routes.includes("router.post('/checkout', authenticate, createCheckoutSession)") && routes.includes("router.post('/portal', authenticate, createBillingPortalSession)"));
check('subscription payload returns stable fields', billing.includes('plan: effectivePlan') && billing.includes('status,') && billing.includes('limits,') && billing.includes('usage,') && billing.includes('remaining:') && billing.includes('resetAt: resetAt.toISOString()') && billing.includes('isLocalSimulation') && billing.includes('stripeConfigured'));
check('missing subscription resolves through safe fallback', billing.includes('ensureSubscription') && billing.includes("Subscription.create") && billing.includes("plan: 'free'"));
check('checkout validates server-side plan and configured price ids', controller.includes('isCheckoutPlan(plan)') && controller.includes('getStripePriceId(plan)') && controller.includes('STRIPE_NOT_CONFIGURED'));
check('portal validates customer id and missing config safely', controller.includes("isStripeId(subscription.stripeCustomerId, 'cus_')") && controller.includes('BILLING_CUSTOMER_NOT_FOUND'));
check('Stripe failures return structured safe errors', controller.includes('safeStripeError') && controller.includes('STRIPE_CHECKOUT_FAILED') && controller.includes('STRIPE_PORTAL_FAILED'));
check('500 paths do not expose raw error.message', controller.includes('safeServerError') && !controller.includes('error: error.message'));
check('subscription model stores webhook idempotency/state fields', model.includes('stripeProcessedEventIds') && model.includes('stripeUpdatedAt') && model.includes('isLocalSimulation'));

if (failed) process.exit(1);
console.log('\n[PASS] Billing API stability verification passed.');
