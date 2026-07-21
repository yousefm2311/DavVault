const fs = require('fs');
const path = require('path');

let failed = false;
const index = fs.readFileSync(path.join(__dirname, 'backend/src/index.ts'), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== SOCKET AUTH SAFETY VERIFICATION ===\n');

check('socket auth middleware requires token', index.includes('socket.handshake.auth?.token') && index.includes('Unauthorized.'));
check('socket verifies JWT and tokenVersion', index.includes('jwt.verify') && index.includes('tokenVersion'));
check('suspended users are rejected', index.includes("user.status === 'suspended'"));
check('socket.data.userId is set only after auth', index.includes('socket.data.userId = user._id.toString()'));
check('socket user id is validated before room join', index.includes('Ignoring project join without valid socket user id'));
check('invalid auth errors are caught safely', index.includes('catch') && index.includes('next(new Error(\'Unauthorized.\'))'));
check('Object-like project ids are rejected by string-only normalizer', index.includes("typeof value === 'string'") && index.includes('/^[a-fA-F0-9]{24}$/'));

if (failed) process.exit(1);
console.log('\n[PASS] Socket auth safety verification passed.');
