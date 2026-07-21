const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== STRIPE WEBHOOK SAFETY VERIFICATION ===\n');

const index = read('backend/src/index.ts');
const controller = read('backend/src/controllers/subscription.controller.ts');

check('webhook route uses raw JSON body before JSON parser', index.indexOf("app.post('/api/subscription/webhook', express.raw") > -1 && index.indexOf("app.use(express.json") > index.indexOf("app.post('/api/subscription/webhook'"));
check('webhook verifies signature before JSON parse', controller.indexOf('verifyStripeSignature(rawBody, signature, webhookSecret)') < controller.indexOf('JSON.parse(rawBody.toString'));
check('signature verification uses timingSafeEqual', controller.includes('crypto.timingSafeEqual'));
check('webhook event id is validated as Stripe event id', controller.includes("isStripeId(event.id, 'evt_')"));
check('duplicate webhook events are idempotent', controller.includes('stripeProcessedEventIds?.includes(stripeEventId)') && controller.includes('$addToSet'));
check('stale webhook events do not overwrite newer state', controller.includes('current.stripeUpdatedAt') && controller.includes('eventDate < current.stripeUpdatedAt'));
check('Stripe status is explicitly mapped', controller.includes('mapStripeStatus(stripeSubscription.status)') && read('backend/src/utils/billing.ts').includes('export const mapStripeStatus'));
check('unknown/missing references are safely ignored', controller.includes("isStripeId(subscriptionId, 'sub_')") && controller.includes('if (existing)'));
check('webhook responses do not expose raw body/secrets', !controller.includes('json({ rawBody') && !controller.includes('console.log(rawBody') && !controller.includes('process.env.STRIPE_WEBHOOK_SECRET,'));

if (failed) process.exit(1);
console.log('\n[PASS] Stripe webhook safety verification passed.');
