const path = require('path');
const mongoose = require('../backend/node_modules/mongoose');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const email = process.argv[2];
const role = process.argv[3] || 'superadmin';

if (!email || !['admin', 'superadmin'].includes(role)) {
  console.error('Usage: node scratch/make-admin.js <email> [admin|superadmin]');
  process.exit(1);
}

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    plan: String,
    role: { type: String, default: 'user' },
    status: { type: String, default: 'active' },
  },
  { timestamps: true, strict: false }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/devvault';
  await mongoose.connect(uri);

  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    { role, status: 'active' },
    { new: true }
  );

  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exitCode = 1;
  } else {
    console.log(`Updated ${user.email} to role=${user.role}, status=${user.status}`);
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
