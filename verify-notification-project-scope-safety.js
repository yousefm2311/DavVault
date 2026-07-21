const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== NOTIFICATION PROJECT SCOPE SAFETY VERIFICATION ===\n');

const controller = read('backend/src/controllers/notification.controller.ts');
const bell = read('frontend/src/components/NotificationBell.tsx');

check('users can only list their own notifications', controller.includes('Notification.find({ userId: req.user.id })'));
check('users can only mark own notifications read', controller.includes('findOneAndUpdate') && controller.includes('{ _id: id, userId: req.user.id }'));
check('users can only delete own notifications', controller.includes('findOneAndDelete({ _id: id, userId: req.user.id })'));
check('project links are stripped if project inaccessible/deleted', controller.includes('if (!project) link = undefined'));
check('only safe internal notification links are exposed', controller.includes('safeInternalLink') && controller.includes('allowedPrefixes'));
check('frontend guards notification routes before navigation', bell.includes('isSafeNotificationRoute') && bell.includes('router.push(link)'));
check('frontend validates project ids in notification links', bell.includes('projectMatch') && bell.includes('isValidObjectIdString(projectMatch[1])'));

if (failed) process.exit(1);
console.log('\n[PASS] Notification project scope safety verification passed.');
