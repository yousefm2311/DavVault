const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== NOTIFICATION API STABILITY VERIFICATION ===\n');

const controller = read('backend/src/controllers/notification.controller.ts');
const routes = read('backend/src/routes/notification.routes.ts');
const service = read('backend/src/services/notification.service.ts');

check('notification routes include list/count/read/all/delete', routes.includes("router.get('/'") && routes.includes("router.get('/unread-count'") && routes.includes("router.put('/:id/read'") && routes.includes("router.put('/mark-all-read'") && routes.includes("router.delete('/:id'"));
check('notification id validation exists', controller.includes("invalidIdResponse(res, 'notificationId')") && controller.includes('isValidObjectIdString(id)'));
check('invalid ids return INVALID_OBJECT_ID', controller.includes("code: 'INVALID_OBJECT_ID'"));
check('missing notifications return NOTIFICATION_NOT_FOUND', controller.includes('NOTIFICATION_NOT_FOUND'));
check('list and unread count are owner scoped', controller.includes('Notification.find({ userId: req.user.id })') && controller.includes('countDocuments({ userId: req.user.id, isRead: false })'));
check('read/delete are owner scoped', controller.includes('{ _id: id, userId: req.user.id }'));
check('notification responses are normalized', controller.includes('normalizeNotification') && controller.includes('toISOString()') && controller.includes('_id: notification._id?.toString()'));
check('project notification links are access checked', controller.includes('projectIdFromLink') && controller.includes('findAccessibleProject(userId, projectId'));
check('500 paths are structured and not raw error.message', controller.includes('serverErrorResponse') && !controller.includes('res.status(500).json({ error: error.message })'));
check('notification service validates userId and sanitizes link', service.includes('Types.ObjectId.isValid(userId)') && service.includes('safeLink'));

if (failed) process.exit(1);
console.log('\n[PASS] Notification API stability verification passed.');
