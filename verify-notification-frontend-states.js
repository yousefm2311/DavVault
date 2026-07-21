const fs = require('fs');
const path = require('path');

let failed = false;
const context = fs.readFileSync(path.join(__dirname, 'frontend/src/context/NotificationContext.tsx'), 'utf8');
const bell = fs.readFileSync(path.join(__dirname, 'frontend/src/components/NotificationBell.tsx'), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== NOTIFICATION FRONTEND STATES VERIFICATION ===\n');

check('notification context exposes fetch/action errors', context.includes('error: string | null') && context.includes('actionError: string | null'));
check('notification fetch errors are visible state, not console-only', context.includes('setError(') && bell.includes('{actionError || error}'));
check('unread count falls back safely on fetch error', context.includes('setUnreadCount(0)'));
check('mark/delete actions validate ids before API calls', context.includes('isValidObjectIdString(id)') && context.includes('Unable to delete notification.'));
check('notification timestamps normalize safely', context.includes('Number.isNaN(createdAt.getTime())') && bell.includes('Unknown time'));
check('notification bell has loading state', bell.includes('Loading notifications') && bell.includes('Loader2'));
check('notification bell has empty state', bell.includes('noNotifications'));
check('notification bell has retry action', bell.includes('RefreshCw') && bell.includes('Retry'));
check('notification link navigation is guarded', bell.includes('isSafeNotificationRoute'));
check('stale/deleted project links are non-clickable', bell.includes("clickable ? 'cursor-pointer' : 'cursor-default'"));

if (failed) process.exit(1);
console.log('\n[PASS] Notification frontend states verification passed.');
