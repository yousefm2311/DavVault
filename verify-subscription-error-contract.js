const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== SUBSCRIPTION ERROR CONTRACT VERIFICATION ===\n');

const controller = read('backend/src/controllers/subscription.controller.ts');
const limits = read('backend/src/middleware/limits.ts');
const project = read('backend/src/controllers/project.controller.ts');

check('checkout invalid plan returns INVALID_PLAN', controller.includes("code: 'INVALID_PLAN'"));
check('Stripe missing config returns structured local fallback', controller.includes("code: 'STRIPE_NOT_CONFIGURED'") && controller.includes('stripeConfigured: false') && controller.includes('isLocalSimulation: true'));
check('webhook signature failures return WEBHOOK_SIGNATURE_INVALID', controller.includes("code: 'WEBHOOK_SIGNATURE_INVALID'"));
check('webhook bad payload failures return WEBHOOK_PAYLOAD_INVALID', controller.includes("code: 'WEBHOOK_PAYLOAD_INVALID'"));
check('limit middleware invalid ids return INVALID_OBJECT_ID', limits.includes("code: 'INVALID_OBJECT_ID'") && limits.includes('isValidMongoId(userId)'));
check('limit middleware failures are structured and safe', limits.includes("code: 'PLAN_LIMIT_CHECK_FAILED'") && !limits.includes('error.message'));
check('limit exceeded responses include stable billing fields', limits.includes("code: 'LIMIT_EXCEEDED'") && limits.includes('remaining,') && limits.includes('resetAt: payload.resetAt') && limits.includes('isLocalSimulation: payload.isLocalSimulation'));
check('storage limit response is structured', project.includes("code: 'STORAGE_LIMIT_EXCEEDED'") && project.includes("resource: 'storageBytes'") && project.includes('requested: expandedBytes'));
check('subscription controller does not leak raw provider errors', !controller.includes('data.error') && !controller.includes('error.stack') && !controller.includes('stack:'));

if (failed) process.exit(1);
console.log('\n[PASS] Subscription error contract verification passed.');
