# Prompt for Cursor — capture round 4 (copy everything below the line)

---

اشتغل على **staging فقط** (`/var/www/emdad-sy-3pl-wms-staging`، branch `staging`، PM2 id 1). الـ production (PM2 id 0، DB `wms_db`) ممنوع تقرب منه. ردّ عليّ بالعربي المصري.

## الهدف
أنا (Claude) كتبت خطة اختبارات كاملة في `docs/testing/` وصوّرت جزء من النظام. ناقص جزء، وانت هتكمّله باستخدام امتداد Chrome اللي معاك (Browser MCP / Claude in Chrome) على **الأدمن** (`https://staging-admin.emdadsy.com`) و**الكلاينت بورتال** (`https://staging-client.emdadsy.com`). مفيش كتابة تستات في المرحلة دي — **تصوير وفحص بس**.

## اقرأ بالترتيب قبل ما تبدأ
1. `docs/testing/00-README-test-strategy.md` (القواعد والـ devices)
2. `docs/testing/20-remaining-capture-backlog.md` ← **ده الشغل المطلوب منك، بند بند**
3. `docs/testing/16-observed-issues-during-capture.md` (اللي اتلقى قبل كده، عشان ما تكررش وتكمل الترقيم من V-077)
4. `docs/testing/screenshots/README.md` و`assign.py` و`visual-notes.md` (طريقة الترقيم والتخزين)
5. `docs/testing/04a-e2e-page-catalogue-admin.md` و`04b-e2e-page-catalogue-client.md` (فيها العناصر اللي متوقعة في كل صفحة)
6. `docs/testing/17-assumptions-to-confirm.md` (افتراضات مش مؤكدة — ما تعتبرهاش bugs مؤكدة)

## قواعد صارمة (ممنوعات)
- **متعملش أي تعديل على البيانات**: ما تعملش submit/save/create/delete/approve/cancel/send/confirm لأي شيء. افتح المودال أو الفورم، صوّر، وبعدين Cancel/Close. لو الزرار مش واضح هل بيغيّر داتا → متدوسش عليه.
- بند §8 في ملف الـ backlog (bulk shipping، Test connection، Register webhook، Google، إنشاء يوزرز، تسجيل خروج للـ owner…) **متعملوش** — بس اكتب في التقرير إيه المطلوب موافقة عليه.
- متكتبش باسوردات أبدًا. لو محتاج logout/login أو حساب role معين → اكتب `NEEDS OWNER` في التقرير وكمّل في البنود اللي بعدها.
- ما تقفلش التحقق من شهادة TLS ولا تدخل عن طريق الـ IP (`187.124.19.162`).
- متلمسش أي أوردر جوه بورتال شركة شحن (Babel/Sila/Sena/Delivery Joud). والداتا الحقيقية للعملاء للقراءة بس.
- لو غيّرت لغة/ثيم، رجّعهم EN/light. لو طبّقت فلاتر في قايمة، دوس Reset.
- ما تعملش `git add .` — حط الملفات بالاسم. ما تكوميتش `dist`/`node_modules`/`graphify-out`.

## طريقة التصوير (4 أجهزة لكل صفحة/حالة)
Desktop 1920×1080، Laptop 1366×768، Tablet 820×1180، Mobile 390×844. لو الأداة بتسمح بـ resize للنافذة أو device emulation استخدمها. لو لا، ممكن تفتح نفس الصفحة جوه `iframe` بنفس عرض الجهاز على صفحة same-origin (ده اللي عملته أنا) — بس اتأكد إن الـ layout بيستجيب للعرض.
اسم الملف: `<NNN>_<route-slug>[_<state>].png` جوه فولدر الجهاز. استمر الترقيم من **105** للأدمن و**031** للكلاينت، وحدّث `index.json` بنفس الشكل (route/state لكل رقم). (الـ PNG متجاهل في git، فهتفضل على الـ VPS — ده طبيعي.)
مع كل صفحة سجّل في `visual-notes.md`: العناصر التفاعلية الموجودة (أزرار/انبتس/دروب داون/تابات)، وأي حاجة غريبة.

## إيه اللي تدوّر عليه وانت بتصوّر (سجّله كـ defect candidate)
- زراير متداخلة أو متقطعة أو مش على نفس الخط (فرق بكسلات)، كروت أو منيوهات طايرة ومش مظبوطة، أي overflow أو scroll أفقي للصفحة، نص متقطع.
- نصوص تقنية للمستخدم (enum خام، UUID بدل كود، رسائل dev، أرقام تذاكر داخلية).
- عناصر لا تعمل أو عنصر بدون سبب لحالته disabled.
- تضارب في الأرقام بين شاشتين، أو العملة غلط، أو label مختلف لنفس الحاجة.
- في العربي: نصوص إنجليزي متبقية، انعكاس ناقص، ترتيب أرقام غلط. في الـ dark: جزر بيضاء، تباين ضعيف.
- UX: بحث بيفضل مكتوب فيه اسم العنصر بعد الاختيار، حقول أرقام مليانة "0" لازم تتمسح، إلخ.
ما تفترضش إن حاجة "غلط" لمجرد إنك شايفها غريبة؛ اكتب "(guess)" لو انت مش متأكد من المطلوب.

## التنفيذ
1. ابدأ بالبنود اللي مش محتاجة logout/roles: §1 → §3 → §4 → §5 → §7 في `20-remaining-capture-backlog.md`.
2. بعدين §2 و§6 (محتاجين المالك) — اكتب في ردك بالظبط إيه اللي محتاجه مني (logout؟ حساب role؟) واستنى؛ كمّل الباقي في الوقت ده.
3. ما تقفش عند أول مشكلة: لو بند مستحيل → `SKIPPED(reason)` وكمّل.
4. اشتغل على دفعات (10–15 صفحة) وكوميت كل دفعة بـ message `docs(testing): capture round 4 – <batch>` ثم `git push origin staging`. الـ trailer: `Co-Authored-By: <اسم الموديل بتاعك>`.

## المطلوب في الآخر (التفاصيل في §9 من ملف الـ backlog)
- الصور + `index.json` محدثين.
- Defects جديدة في `16-observed-issues-during-capture.md` من **V-077** بنفس شكل الجدول.
- ملاحظات خام في `visual-notes.md`.
- تحديث `14-coverage-matrix.md` (§9/§10).
- تقرير مختصر `docs/testing/21-capture-round4-report.md`: اللي اتصوّر (أرقام)، اللي اتخطّى وليه، اللي محتاج موافقة المالك، وعدد الـ defects الجداد حسب الخطورة.
- بلّغني بالتقدم بالشكل ده بعد كل دفعة:

```
╔══════════ CAPTURE ROUND 4 ══════════╗
  Backlog items done : X / Y  (§1 a/b · §3 a/b · §4 a/b · §5 a/b · §7 a/b)
  Blocked on owner   : [قائمة]
  New defect candidates: S1 n · S2 n · S3 n · S4 n
╚═════════════════════════════════════╝
```

مفيش كتابة تستات دلوقتي. لما تخلص ابعتلي إنك خلصت وأنا هكمل على كتابة التستات.
