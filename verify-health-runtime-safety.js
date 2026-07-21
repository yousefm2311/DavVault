const fs = require('fs');
const path = require('path');

let failed = false;
const index = fs.readFileSync(path.join(__dirname, 'backend/src/index.ts'), 'utf8');
const queue = fs.readFileSync(path.join(__dirname, 'backend/src/services/queue.service.ts'), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== HEALTH RUNTIME SAFETY VERIFICATION ===\n');

check('/health endpoint exists', index.includes("app.get('/health'"));
check('health reports Mongo status safely', index.includes("mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'"));
check('health reports queue status safely', index.includes('queueService.getStats().catch') && index.includes('queue,'));
check('health reports integrations as booleans', index.includes('Boolean(process.env.GEMINI_API_KEY') && index.includes('Boolean(process.env.OPENAI_API_KEY'));
check('health reports Stripe config as boolean only', index.includes('stripe: Boolean(process.env.STRIPE_SECRET_KEY') && !index.includes('STRIPE_SECRET_KEY,'));
check('health does not expose connection strings', !index.includes('MONGO_URI,') && !index.includes('REDIS_URL,'));
check('queue getStats has memory fallback shape', queue.includes("mode: 'memory'") && queue.includes('waiting: this.memoryQueue.length'));

if (failed) process.exit(1);
console.log('\n[PASS] Health runtime safety verification passed.');
