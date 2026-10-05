/**
 * Pipeline validation fixture only.
 * NOT an authoritative copy of Egyptian law.
 * Used for deterministic parsing/chunking tests and local demo ingestion.
 */
export const SAMPLE_EMPLOYMENT_LAW_FIXTURE = {
  externalId: "fixture-law-12-2003",
  sourceUrl:
    "https://elpai.idsc.gov.eg/fixture/sample-law-12-2003-pipeline-validation",
  title: "قانون رقم 12 لسنة 2003 بإصدار قانون العمل (عينة تحقق خط الأنابيب)",
  documentType: "LEGISLATION" as const,
  textOrigin: "FIXTURE" as const,
  issuingAuthority: "جمهورية مصر العربية — عينة تحقق غير رسمية",
  year: 2003,
  documentNumber: "12",
  text: `
قانون رقم 12 لسنة 2003 بإصدار قانون العمل
(نص عينة لأغراض اختبار مسار الاستيعاب فقط — ليس نصاً رسمياً)

الباب الأول
أحكام عامة

المادة 1:
يعمل بأحكام قانون العمل المرافق.

المادة 2:
يقصد في تطبيق أحكام هذا القانون بالعامل كل شخص طبيعي يعمل لقاء أجر لدى صاحب عمل وتحت إدارته أو إشرافه.

المادة 69:
لا يجوز فصل العامل إلا إذا ارتكب خطأ جسيماً.

ويعد من قبيل الخطأ الجسيم الحالات الآتية:
1- انتحال العامل شخصية غير صحيحة.
2- ارتكاب العامل خطأ نشأت عنه خسارة جسيمة لصاحب العمل.
`.trim(),
};

export const SAMPLE_SCC_SUMMARY_FIXTURE = {
  externalId: "fixture-scc-summary-1",
  sourceUrl:
    "https://www.sccourt.gov.eg/fixture/sample-judgment-summary-pipeline-validation",
  title: "ملخص حكم دستوري — عينة تحقق خط الأنابيب",
  documentType: "JUDGMENT_SUMMARY" as const,
  textOrigin: "SUMMARY" as const,
  issuingAuthority: "المحكمة الدستورية العليا — عينة تحقق غير رسمية",
  text: `
ملخص حكم (عينة تحقق — ليس حكمًا رسميًا)

القضية رقم 1 لسنة اختبار قضائي
تاريخ الحكم: غير متوفر من المصدر في هذه العينة

المبدأ:
تكفل المحكمة الدستورية العليا الرقابة على دستورية القوانين واللوائح.
`.trim(),
};

export const SAMPLE_HERITAGE_PAGE_FIXTURE = {
  externalId: "fixture-cassation-heritage-p7",
  sourceUrl:
    "https://www.cc.gov.eg/fixture/heritage-library/sample-page-7-pipeline-validation",
  title: "مكتبة تراث محكمة النقض — صفحة تاريخية (عينة تحقق)",
  documentType: "HISTORICAL_LEGAL_MATERIAL" as const,
  textOrigin: "OCR" as const,
  issuingAuthority: "محكمة النقض المصرية — عينة تحقق غير رسمية",
  pageNumber: 7,
  year: 1920,
  text: `
[OCR — نص مشتق من صورة صفحة تاريخية — عينة تحقق]

كتاب قانوني تاريخي — صفحة 7

المادة 12:
تختص المحكمة بنظر الطعون وفق القواعد المقررة قانونًا.
`.trim(),
};

export const SAMPLE_PARLIAMENT_BILL_FIXTURE = {
  externalId: "fixture-parliament-bill-1",
  sourceUrl:
    "https://www.parliament.gov.eg/fixture/sample-bill-pipeline-validation",
  title: "مشروع قانون — عينة تحقق خط الأنابيب (تاريخ تشريعي)",
  documentType: "LEGISLATIVE_HISTORY" as const,
  textOrigin: "FIXTURE" as const,
  issuingAuthority: "مجلس النواب المصري — عينة تحقق غير رسمية",
  text: `
مشروع قانون (عينة تحقق — ليس قانونًا نافذًا)

الفصل الأول
أحكام تمهيدية

المادة 1:
يهدف هذا المشروع إلى تنظيم مسألة افتراضية لأغراض الاختبار فقط.
`.trim(),
};
