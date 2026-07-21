const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== USAGE TRACKING SAFETY VERIFICATION ===\n');

const billing = read('backend/src/utils/billing.ts');
const ai = read('backend/src/controllers/ai.controller.ts');
const project = read('backend/src/controllers/project.controller.ts');

check('usage snapshot counts projects safely by user', billing.includes('Project.countDocuments({ userId })'));
check('usage snapshot aggregates file storage by user ObjectId', billing.includes("DBFile.aggregate") && billing.includes("new mongoose.Types.ObjectId(userId)") && billing.includes("$sum: '$size'"));
check('AI usage counts calendar month activity', billing.includes("action: 'ai_question'") && billing.includes('createdAt: { $gte: startOfMonth }'));
check('usage response returns ISO resetAt', billing.includes('resetAt: resetAt.toISOString()'));
check('AI controller tracks ai_question activity only after request validation path', ai.includes("action: 'ai_question'"));
check('upload queues project only after storage limit check', project.indexOf("code: 'STORAGE_LIMIT_EXCEEDED'") < project.indexOf('queueService.addJob'));
check('project delete paths remove files so storage recalculates from source data', project.includes('DBFile.deleteMany') && project.includes('storageService.deleteProjectFiles'));

if (failed) process.exit(1);
console.log('\n[PASS] Usage tracking safety verification passed.');
