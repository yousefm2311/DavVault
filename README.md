<div align="center">
  <!-- مسار لوجو المشروع -->
  <img src="frontend/public/globe.svg" alt="DevVault AI Logo" width="120" />

  # 🧠 DevVault AI

  **المستودع الذكي والذاكرة المركزية للمطورين وفرق البرمجة المعتمد على الذكاء الاصطناعي.**

  <!-- شارات التقنيات -->
  [![Next.js](https://img.shields.io/badge/Next.js-16.2.9-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
</div>

---

## 🚀 نظرة عامة (Overview)

**DevVault AI** هو أداة متقدمة لإنتاجية المطورين تعمل كمستودع معرفي متكامل (Knowledge Repository). يقوم النظام بتحليل وفهرسة قواعد البيانات البرمجية (Codebases)، وتخزين قوالب البنية التحتية (Architecture Blueprints)، ودروس تصحيح الأخطاء (Debugging Lessons). باستخدام الرسم البياني المعرفي (Knowledge Graph) ونماذج الذكاء الاصطناعي، يفهم المشروع العلاقات بين الأكواد ليعمل كذاكرة طويلة الأمد لك ولفريقك، مع تقديم سياق دقيق للذكاء الاصطناعي بناءً على أسلوبك البرمجي (Developer DNA).

---

## ✨ الميزات الرئيسية (Key Features)

*   🧠 **الرسم البياني المعرفي (Knowledge Graph):** تحليل وفهم العلاقات بين مختلف الكيانات البرمجية (Logical Entities) داخل المشروع للحصول على رؤى أعمق.
*   🤖 **مساعد الذكاء الاصطناعي المتكامل (AI Context Builder):** تكامل مع (OpenAI / Google Gemini) لتقديم ردود ذكية، البحث المتقدم، وتتبع السياق (Context Trace) لفهم كودك.
*   🧬 **البصمة البرمجية (Stylistic Profile / Developer DNA):** يتعلم النظام أسلوبك البرمجي، وطريقة تسميتك للمتغيرات ليقوم الذكاء الاصطناعي بتقديم حلول متوافقة مع نمط كتابتك.
*   🛠️ **دروس تصحيح الأخطاء (Debugging Lessons):** حفظ الأخطاء السابقة وجذور المشكلة والحلول (Diffs) لتكون مرجعاً ذكياً يمنع تكرار نفس الأخطاء.
*   📦 **أصول الأكواد والقوالب (Code Assets & Blueprints):** مكتبة مركزية لحفظ وتخزين الأكواد القابلة لإعادة الاستخدام والبنى التحتية للمشاريع بضغطة زر.
*   ⚡ **تحديثات بالوقت الفعلي (Real-time Collaboration):** مزامنة فورية وأدوات تعاون للفِرق باستخدام `Socket.IO`.
*   💳 **نظام اشتراكات متكامل:** دعم خطط Pro و Team مع تكامل كامل مع Stripe لمعالجة المدفوعات.

---

## 🏗️ البنية التحتية والتقنيات (Architecture & Tech Stack)

تم بناء المشروع باستخدام بنية حديثة قابلة للتوسع، مقسمة إلى واجهة مستخدم (Frontend) تفاعلية وخادم خلفي (Backend) قوي يعتمد على معالجة الطوابير (Queues) للأحمال الثقيلة.

### الواجهة الأمامية (Frontend)
*   **إطار العمل:** [Next.js 16 (React 19)](https://nextjs.org/)
*   **التصميم والتنسيق:** Tailwind CSS v4, Framer Motion (للحركات)
*   **المحرر والأدوات:** Monaco Editor (لكتابة وتعديل الكود), ReactFlow (لرسم الخرائط المعرفية)
*   **الاتصال اللحظي:** Socket.IO Client

### الواجهة الخلفية (Backend)
*   **بيئة التشغيل:** [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/) (مع TypeScript)
*   **قاعدة البيانات:** MongoDB (عبر Mongoose) للبيانات المهيكلة، و Redis للتخزين المؤقت والـ Sessions.
*   **معالجة المهام (Background Jobs):** BullMQ لإدارة طوابير تحليل الأكواد وفهرستها.
*   **الذكاء الاصطناعي:** `@google/generative-ai` و `openai` لبناء السياق وتحليل الأكواد.
*   **المصادقة والدفع:** JWT, OAuth (Google/GitHub), و Stripe.

---

## 📂 هيكل المجلدات (Directory Structure)

```text
DevVault/
├── backend/                  # خادم Node.js / Express
│   ├── src/                  
│   │   ├── controllers/      # وحدات التحكم (API Endpoints)
│   │   ├── models/           # مخططات قواعد البيانات (Mongoose Schemas)
│   │   ├── routes/           # مسارات الـ API
│   │   ├── services/         # منطق الأعمال (AI, Parsing, Queues, etc.)
│   │   └── utils/            # أدوات مساعدة (Domain Mappers, Billing)
├── frontend/                 # تطبيق Next.js
│   ├── src/
│   │   ├── app/              # صفحات التطبيق (Next.js App Router)
│   │   ├── components/       # مكونات واجهة المستخدم (UI Components)
│   │   └── context/          # إدارة الحالة (Auth, Notifications, etc.)
├── docs/                     # وثائق المشروع (Domain Models, AI Context Trace)
├── scripts/                  # سكربتات مساعدة لصيانة النظام
└── docker-compose.yml        # إعدادات Docker لتشغيل البيئة المحلية
```

---

## 🚀 البدء السريع (Getting Started)

### المتطلبات الأساسية (Prerequisites)
*   Node.js >= 20.0.0
*   Docker & Docker Compose (لتشغيل قواعد البيانات محلياً)
*   مفاتيح API لـ (OpenAI أو Gemini) و Stripe (اختياري للإنتاج)

### خطوات التثبيت وتشغيل المشروع

1. **تشغيل الخدمات المحلية (Database & Redis):**
   ```bash
   docker compose up -d mongo redis
   ```

2. **تجهيز متغيرات البيئة:**
   انسخ ملفات `.env.example` وقم بتعبئة البيانات اللازمة:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```
   *ملاحظة: يمكنك تشغيل التطبيق بدون مفاتيح AI و Stripe، حيث سيعمل النظام على وضع "المحاكاة المحلية" (Local Simulation).*

3. **تشغيل الخادم الخلفي (Backend):**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

4. **تشغيل الواجهة الأمامية (Frontend):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **فحص حالة النظام (Health Check):**
   تأكد من أن الخادم يعمل بشكل سليم عبر:
   ```bash
   curl http://localhost:5001/health
   ```

---

## 🛡️ الترخيص (License)
هذا المشروع خاص ومملوك بالكامل. جميع الحقوق محفوظة.
