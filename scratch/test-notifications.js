const path = require('path');
const mongoose = require('../backend/node_modules/mongoose');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const userId = process.argv[2];

if (!userId) {
  console.error('Usage: node scratch/test-notifications.js <userId>');
  process.exit(1);
}

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
    isRead: { type: Boolean, default: false },
    link: { type: String },
  },
  { timestamps: true }
);

const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/devvault';
  await mongoose.connect(uri);

  await Notification.insertMany([
    {
      userId,
      title: 'تم تجهيز المشروع',
      message: 'اكتملت فهرسة مشروع التجربة وأصبح جاهزاً للبحث والمحادثة.',
      type: 'success',
      link: '/projects',
    },
    {
      userId,
      title: 'تنبيه استخدام',
      message: 'اقتربت من حد أسئلة الذكاء الشهري. راجع صفحة الفوترة للترقية.',
      type: 'warning',
      link: '/billing',
    },
    {
      userId,
      title: 'فشل اختباري',
      message: 'هذا إشعار خطأ تجريبي لاختبار شكل الحالة الحمراء.',
      type: 'error',
    },
  ]);

  console.log('Inserted 3 test notifications.');
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
