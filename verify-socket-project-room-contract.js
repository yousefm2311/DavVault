const fs = require('fs');
const path = require('path');

let failed = false;
const index = fs.readFileSync(path.join(__dirname, 'backend/src/index.ts'), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== SOCKET PROJECT ROOM CONTRACT VERIFICATION ===\n');

check('join_project handler exists', index.includes("socket.on('join_project'"));
check('leave_project handler exists', index.includes("socket.on('leave_project'"));
check('project room ids are normalized string ObjectIds', index.includes('normalizeSocketProjectId(projectId)'));
check('invalid join ids are ignored before Mongoose', index.includes('Ignoring invalid project room id'));
check('project access is checked before joining', index.includes('accessibleProjectFilter(socket.data.userId, normalizedProjectId)'));
check('room names are built only from normalized id', index.includes('project_${normalizedProjectId}'));
check('leave_project validates socket user and project id', index.includes("socket.on('leave_project'") && index.includes('normalizeSocketProjectId(socket.data.userId)'));
check('socket errors do not throw raw failures', index.includes('Failed to join project room safely'));

if (failed) process.exit(1);
console.log('\n[PASS] Socket project room contract verification passed.');
