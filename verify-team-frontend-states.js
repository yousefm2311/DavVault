const fs = require('fs');
const path = require('path');

let failed = false;
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}`);
  if (!condition) failed = true;
};

console.log('=== TEAM FRONTEND STATES VERIFICATION ===\n');

const page = read('frontend/src/app/team/page.tsx');

check('team page has loading state', page.includes('loadingTeam') && page.includes('SectionSkeleton'));
check('team page has fetch error and retry state', page.includes('teamError') && page.includes('Retry'));
check('team page has empty member state', page.includes('No workspace members yet.'));
check('team page has invite pending/error/success states', page.includes('inviting') && page.includes('inviteError') && page.includes('inviteSuccess'));
check('team page has member limit reached state', page.includes('Member limit reached') && page.includes('memberLimit.remaining <= 0'));
check('team page disables member mutation buttons during active mutation', page.includes('removingMemberId') && page.includes('disabled={removingMemberId === memberId}'));
check('team page respects backend canManageMembers flag', page.includes('canManageMembers') && page.includes('!canManageMembers'));
check('team page handles missing ids safely for remove', page.includes("String(u?._id || u?.id || '')"));

if (failed) process.exit(1);
console.log('\n[PASS] Team frontend states verification passed.');
