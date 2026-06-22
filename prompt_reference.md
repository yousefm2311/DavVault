# DevVault AI - Project Reference Specifications

## الفكرة الأساسية
DevVault AI هو تطبيق يعمل كذاكرة هندسية ذكية للمبرمجين، يجمع بين GitHub وNotion وChatGPT وVSCode Search، لتخزين وفهم واسترجاع معرفة المطورين من مشاريعهم القديمة والأكواد والأخطاء والملاحظات والقرارات التقنية.

## الفئات المستهدفة
* المبرمجون المستقلون (Freelancers)
* مطورو Flutter و Node.js
* فرق الشركات الصغيرة والمتوسطة
* طلاب تخصصات هندسة البرمجيات والعلوم التقنية

## التقنيات الأساسية (Tech Stack)
### Backend
- **Node.js** & **Express.js** (مع TypeScript لضمان القوة والترتيب)
- **MongoDB** & **Mongoose**
- **MongoDB Atlas Vector Search** (مع نظام محلي بديل لـ Cosine Similarity للتطوير المحلي)
- **JWT Authentication** (مع Access/Refresh Tokens)
- **Redis** & **BullMQ** لجدولة ومعالجة ملفات الـ ZIP في الخلفية
- **Multer** لرفع الملفات
- **Socket.io** للتحديثات الحية أثناء معالجة المشاريع

### AI & Embeddings
- **OpenAI API** / **Gemini API** / **Ollama** للـ LLM والـ Embeddings
- **RAG System** (Retrieval-Augmented Generation) للبحث المعرفي
- **Code Entity Extractor** لاستخراج الدوال والفئات والمكونات تلقائياً
- **Semantic & Keyword Hybrid Search**

### Storage
- **Supabase Storage** / **AWS S3** (مع نظام محلي Local Storage كبديل افتراضي)
- دعم رفع ملفات الـ ZIP والملفات الفردية

### Frontend
- **Next.js** (App Router)
- **Tailwind CSS**
- **Shadcn UI**
- **Framer Motion** للأنيمشنز
- **Monaco Editor** لعرض الأكواد البرمجية والتفاعل معها
- **React Flow** لرسم العلاقات الرسومية بين الملفات (Graph View)

---

## الميزات المطلوبة في MVP (المرحلة الأولى)
1. **نظام المصادقة (Auth)**: تسجيل حساب، دخول، Refresh Token، ودعم الدخول بواسطة Google و GitHub.
2. **لوحة التحكم (Dashboard)**: إحصائيات المشاريع، الملفات، الأخطاء، شريط بحث Spotlight في المنتصف.
3. **رفع المشاريع (ZIP Project Upload)**: رفع مشروع ZIP واستخراجه بأمان وتصفية الملفات غير المرغوبة (node_modules، .git) وتحليلها.
4. **معالجة وحفظ الملفات (Processing & Storage)**: تخزين الملفات في MongoDB وتوليد embeddings للمحتوى.
5. **البحث الشامل (Universal Search)**: بحث هجين (دلالي ونصي) يفتح بواسطة `Cmd+K` أو `Ctrl+K`.
6. **دردشة الذكاء الاصطناعي (AI Chat)**: دردشة ذكية مع الملفات مع إظهار المصادر والمراجع البرمجية وأكواد Monaco.
7. **عارض الأكواد (Code Viewer)**: Monaco Editor مدمج مع شرح ذكي وتوليد أكواد بديلة وحفظها كـ Snippet.
8. **مكتبة الأكواد (Snippet Library)**: تصنيف تلقائي بالذكاء الاصطناعي ونسخ الكود.
9. **مكتبة الأخطاء (Error Library)**: توثيق الأخطاء وحلولها والكود قبل وبعد التعديل.
10. **نظرة عامة على المشروع (Project Overview)**: إحصائيات اللغة، التوثيق التلقائي، شجرة الملفات، والدردشة الخاصة بالمشروع.

---

## ميزات المرحلة الثانية (التوسعات اللاحقة)
- **Graph View**: خريطة العلاقات التفاعلية بين الملفات والموديلات والمتحكمات.
- **Developer DNA**: تحليل لغات البرمجة المفضلة، وأنماط التسمية والـ Architecture.
- **Reusable Systems**: حفظ أنظمة كاملة (مثل نظام الدفع أو التسجيل) وإعادة توليدها.
- **Time Machine**: استرجاع المعرفة حسب الأشهر والسنوات السابقة.
- **Code Health**: تحليل صحة المشروع، الكود المتكرر، المشاكل الأمنية والثغرات.
- **Team Brain**: مساحات العمل المشتركة للفرق وإدارة الصلاحيات وحفظ معرفة الموظفين المغادرين.

---

## Design System & UX
- **الألوان الأساسية**: Dark Theme افتراضي.
  - Background: `#0A0A0A`
  - Surface: `#111111`
  - Card: `#1C1C1E`
  - Border: `rgba(255,255,255,0.08)`
  - Accent Color: `#0A84FF` (Apple Blue)
  - Success: `#30D158`
  - Warning: `#FFD60A`
  - Danger: `#FF453A`
  - Text Primary: `#FFFFFF`
  - Text Secondary: `#A1A1AA`
- **التصميم**: نظيف بأسلوب Apple و Linear و Notion، زوايا مستديرة (20px-28px)، تباعد واسع، حركات انتقالية سلسة (200ms - 300ms).
