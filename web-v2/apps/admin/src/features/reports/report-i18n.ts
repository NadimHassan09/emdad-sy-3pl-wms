const AR: Record<string, string> = {
  'Date from': 'من تاريخ',
  'Date to': 'إلى تاريخ',
  Generate: 'إنشاء',
  'Export CSV': 'تصدير CSV',
  'Export Excel': 'تصدير Excel',
  List: 'قائمة',
  Graph: 'رسم',
  Pivot: 'محوري',
  'Group by': 'تجميع حسب',
  Bar: 'أعمدة',
  Line: 'خط',
  Pie: 'دائري',
  Filters: 'فلاتر',
  'Report workspace': 'مساحة التقرير',
  'Generate a report to preview results.': 'أنشئ تقريراً لمعاينة النتائج.',
  'Server-side reporting': 'تقارير من الخادم',
  'Paginated preview and export — no bulk client fetch.':
    'معاينة مقسمة وتصدير من الخادم — بدون تحميل ضخم في المتصفح.',
  'No rows match the current filters.': 'لا توجد صفوف مطابقة للفلاتر الحالية.',
  'Served from server cache.': 'نتيجة من ذاكرة التخزين المؤقت للخادم.',
  None: 'بدون',
  'Reporting Center': 'مركز التقارير',
  'Warehouse not configured': 'المستودع غير مُعد',
  'Not permitted': 'غير مصرح',
  'Your role is not permitted to view this report.': 'دورك لا يسمح بعرض هذا التقرير.',
  'Select a warehouse or configure a default warehouse.': 'اختر مستودعاً أو اضبط مستودعاً افتراضياً.',
  'Loading report from server…': 'جارٍ تحميل التقرير من الخادم…',
  'Report not found': 'التقرير غير موجود',
  'Unknown report path.': 'مسار تقرير غير معروف.',
}

export function reportTr(label: string, isArabic: boolean): string {
  if (!isArabic) return label
  return AR[label] ?? label
}
