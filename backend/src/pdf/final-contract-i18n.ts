import type { DocLang } from './i18n';

type Msg = { en: string; ar: string };

const M = (en: string, ar: string): Msg => ({ en, ar });

export const FC_LABELS = {
  documentTitle: M('3PL WAREHOUSE CONTRACT', 'عقد مستودع 3PL'),
  contractNo: M('Contract No.', 'رقم العقد'),
  sectionParties: M('1. PARTIES', '1. الأطراف'),
  serviceProvider: M('SERVICE PROVIDER (Provider)', 'مقدم الخدمة (المزود)'),
  clientCustomer: M('CLIENT (Customer)', 'العميل'),
  companyName: M('Company Name', 'اسم الشركة'),
  companyType: M('Company Type', 'نوع الشركة'),
  address: M('Address', 'العنوان'),
  phone: M('Phone', 'الهاتف'),
  email: M('Email', 'البريد الإلكتروني'),
  taxId: M('Tax ID', 'الرقم الضريبي'),
  partiesIntro: M(
    'This Warehouse Services Agreement ("Agreement") is entered into as of the Issue Date above by and between the Service Provider and the Client (collectively, the "Parties").',
    'يُبرم اتفاقية خدمات المستودع هذه ("الاتفاقية") اعتباراً من تاريخ الإصدار أعلاه بين مقدم الخدمة والعميل (يُشار إليهما معاً بـ "الأطراف").',
  ),
  sectionScope: M('2. SCOPE OF SERVICES', '2. نطاق الخدمات'),
  sectionPricing: M('3. PRICING & FEES', '3. التسعير والرسوم'),
  colService: M('SERVICE', 'الخدمة'),
  colDescription: M('DESCRIPTION', 'الوصف'),
  colUnit: M('UNIT', 'الوحدة'),
  colRate: M('RATE (USD)', 'السعر (USD)'),
  colBilling: M('BILLING FREQUENCY', 'دورة الفوترة'),
  pricingFootnote: M(
    '* Additional charges may apply for special handling, overweight, or oversized items.',
    '* قد تُطبق رسوم إضافية للمعالجة الخاصة أو الأوزان/الأحجام الزائدة.',
  ),
  sectionProviderObligations: M('4. PROVIDER\'S OBLIGATIONS', '4. التزامات مقدم الخدمة'),
  sectionClientObligations: M('5. CLIENT\'S OBLIGATIONS', '5. التزامات العميل'),
  sectionTerm: M('6. TERM & TERMINATION', '6. المدة والإنهاء'),
  sectionLiability: M('7. LIABILITY & INSURANCE', '7. المسؤولية والتأمين'),
  sectionGeneral: M('8. GENERAL TERMS', '8. أحكام عامة'),
  signatures: M('SIGNATURES', 'التواقيع'),
  signature: M('Signature', 'التوقيع'),
  name: M('Name', 'الاسم'),
  title: M('Title', 'المسمى الوظيفي'),
  date: M('Date', 'التاريخ'),
  providerCompanyType: M('Logistics & Warehousing Company', 'شركة لوجستيات وتخزين'),
} as const;

export const FC_SCOPE_SERVICES: Msg[] = [
  M('Warehousing and storage of goods', 'تخزين البضائع في المستودعات'),
  M('Inventory management', 'إدارة المخزون'),
  M('Order fulfillment', 'تنفيذ الطلبات'),
  M('Packaging and labeling', 'التغليف والوسم'),
  M('Transportation coordination', 'تنسيق النقل'),
  M('Return processing', 'معالجة المرتجعات'),
];

export const FC_PRICING_ROWS = [
  {
    service: M('Storage', 'التخزين'),
    description: M('Per Pallet / Per Month', 'لكل طبلية / شهرياً'),
    unit: M('Pallet / Month', 'طبلية / شهر'),
    billing: M('Monthly', 'شهري'),
    rateKey: 'rateStorage' as const,
  },
  {
    service: M('Inbound Handling', 'معالجة الوارد'),
    description: M('Receiving & Inspection', 'الاستلام والفحص'),
    unit: M('Per Pallet', 'لكل طبلية'),
    billing: M('Per Inbound', 'لكل وارد'),
    rateKey: 'rateInboundHandling' as const,
  },
  {
    service: M('Outbound Handling', 'معالجة الصادر'),
    description: M('Picking, Packing & Dispatch', 'التقاط وتغليف وإرسال'),
    unit: M('Per Order', 'لكل طلب'),
    billing: M('Per Order', 'لكل طلب'),
    rateKey: 'rateOutboundHandling' as const,
  },
  {
    service: M('Value Added Services', 'خدمات القيمة المضافة'),
    description: M('Labeling / Assembly / Other', 'وسم / تجميع / أخرى'),
    unit: M('Per Unit / Hour', 'لكل وحدة / ساعة'),
    billing: M('Per Use', 'حسب الاستخدام'),
    rateKey: 'rateValueAddedServices' as const,
  },
  {
    service: M('Return Processing', 'معالجة المرتجعات'),
    description: M('Processing & Restocking', 'المعالجة وإعادة التخزين'),
    unit: M('Per Return', 'لكل مرتجع'),
    billing: M('Per Return', 'لكل مرتجع'),
    rateKey: 'rateReturnProcessing' as const,
  },
];

export const FC_PROVIDER_OBLIGATIONS: Msg[] = [
  M('Provide secure storage and care of Client goods in accordance with industry standards.', 'توفير تخزين آمن ورعاية بضائع العميل وفقاً لمعايير الصناعة.'),
  M('Maintain accurate inventory records and provide regular reporting.', 'الحفاظ على سجلات مخزون دقيقة وتقديم تقارير منتظمة.'),
  M('Operate warehouse facilities in compliance with applicable laws and safety regulations.', 'تشغيل مرافق المستودع وفقاً للقوانين واللوائح السلامة المعمول بها.'),
  M('Take reasonable measures to protect goods from loss, damage, theft, or deterioration.', 'اتخاذ تدابير معقولة لحماية البضائع من الفقد أو التلف أو السرقة أو التدهور.'),
  M('Notify Client promptly of any incidents affecting stored goods.', 'إخطار العميل فوراً بأي حوادث تؤثر على البضائع المخزنة.'),
];

export const FC_CLIENT_OBLIGATIONS: Msg[] = [
  M('Ensure all goods are legally owned and free from liens or encumbrances.', 'ضمان أن جميع البضائع مملوكة قانونياً وخالية من أي رهون أو قيود.'),
  M('Provide accurate product information, quantities, and handling instructions.', 'تقديم معلومات دقيقة عن المنتجات والكميات وتعليمات المناولة.'),
  M('Not store hazardous, illegal, or prohibited materials without prior written approval.', 'عدم تخزين مواد خطرة أو غير قانونية أو محظورة دون موافقة خطية مسبقة.'),
  M('Pay all fees according to the agreed billing schedule.', 'سداد جميع الرسوم وفقاً لجدول الفوترة المتفق عليه.'),
  M('Indemnify Provider against claims arising from the nature or ownership of Client goods.', 'تعويض مقدم الخدمة عن أي مطالبات ناشئة عن طبيعة أو ملكية بضائع العميل.'),
];

export const FC_TERM_BULLETS: Msg[] = [
  M('Initial term of twelve (12) months from the Issue Date.', 'مدة أولية اثني عشر (12) شهراً من تاريخ الإصدار.'),
  M('Automatically renews for successive twelve-month periods unless either Party provides sixty (60) days written notice of non-renewal.', 'يتجدد تلقائياً لفترات متتالية مدتها اثنا عشر شهراً ما لم يُخطر أحد الطرفين الطرف الآخر خطياً بعدم التجديد قبل ستين (60) يوماً.'),
  M('Either Party may terminate for material breach with thirty (30) days written notice if the breach is not cured.', 'يجوز لأي طرف إنهاء الاتفاقية لخرق جوهري بإشعار خطي قبل ثلاثين (30) يوماً إذا لم يُصحَّح الخرق.'),
];

export const FC_LIABILITY_BULLETS: Msg[] = [
  M('Provider liability is limited to the actual value of goods lost or damaged due to Provider negligence.', 'مسؤولية مقدم الخدمة محدودة بالقيمة الفعلية للبضائع المفقودة أو التالفة بسبب إهماله.'),
  M('Client is responsible for maintaining adequate insurance on stored goods.', 'العميل مسؤول عن الحفاظ على تأمين كافٍ على البضائع المخزنة.'),
  M('Provider maintains industry-standard warehouse insurance coverage.', 'يحتفظ مقدم الخدمة بتغطية تأمين مستودعات وفق معايير الصناعة.'),
];

export const FC_GENERAL_BULLETS: Msg[] = [
  M('This Agreement constitutes the entire agreement between the Parties.', 'تشكل هذه الاتفاقية الاتفاق الكامل بين الطرفين.'),
  M('Amendments must be in writing and signed by both Parties.', 'يجب أن تكون التعديلات خطية وموقعة من كلا الطرفين.'),
  M('Governed by the laws of the applicable jurisdiction as agreed by the Parties.', 'تخضع للقوانين المعمول بها كما يتفق عليها الطرفان.'),
  M('Disputes shall be resolved through good-faith negotiation, then binding arbitration if unresolved.', 'تُحل النزاعات بالتفاوض بحسن نية، ثم التحكيم الملزم إذا لم تُحل.'),
  M('Notices shall be sent to the addresses listed in Section 1.', 'تُرسل الإشعارات إلى العناوين المذكورة في القسم 1.'),
];

export function fcMsg(msg: Msg, lang: DocLang): string {
  return lang === 'ar' ? msg.ar : msg.en;
}

export function fcLabels(lang: DocLang): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, msg] of Object.entries(FC_LABELS)) {
    out[key] = fcMsg(msg, lang);
  }
  return out;
}

export function fcBullets(items: Msg[], lang: DocLang): string[] {
  return items.map((m) => fcMsg(m, lang));
}

export function formatUsd(amount: number, lang: DocLang): string {
  const formatted = amount.toLocaleString(lang === 'ar' ? 'ar-SY' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${formatted}`;
}
