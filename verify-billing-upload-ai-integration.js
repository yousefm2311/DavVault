const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== BILLING UPLOAD/AI INTEGRATION VERIFICATION ===\n');

const projectRoutes = read('backend/src/routes/project.routes.ts');
const aiRoutes = read('backend/src/routes/ai.routes.ts');
const limits = read('backend/src/middleware/limits.ts');
const project = read('backend/src/controllers/project.controller.ts');
const ai = read('backend/src/controllers/ai.controller.ts');

check('upload route applies project limit before upload handling', projectRoutes.includes("authenticate, checkPlanLimits('project'), uploadProjectZip, uploadProject"));
check('AI routes apply aiQuestions limit before controller handlers', aiRoutes.includes("authenticate, checkPlanLimits('aiQuestions')") && aiRoutes.includes('handleChat') && aiRoutes.includes('explainCodeFile'));
check('limit middleware returns billing fields consumed by clients', limits.includes('plan: payload.plan') && limits.includes('status: payload.status') && limits.includes('resetAt: payload.resetAt'));
check('upload storage limit blocks before project creation/queueing', project.indexOf("STORAGE_LIMIT_EXCEEDED") < project.indexOf('Project.create') && project.indexOf("STORAGE_LIMIT_EXCEEDED") < project.indexOf('queueService.addJob'));
check('AI usage is tied to existing Activity domain', ai.includes("action: 'ai_question'") && ai.includes("entityType: 'project'") && ai.includes("entityType: 'file'"));
check('billing failures preserve existing upload/AI response shapes', project.includes('PROJECT_UPLOAD_FAILED') && ai.includes('AI_CHAT_FAILED') && ai.includes('AI_EXPLAIN_FAILED'));

if (failed) process.exit(1);
console.log('\n[PASS] Billing upload/AI integration verification passed.');
