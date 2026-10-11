import type { LevelId } from "@/types/level";
import type { LevelDefinition } from "@/types/topology";
import type { Language } from "./translate";

interface LevelCopy {
  title: string;
  summary: string;
}

interface ArabicLevel extends LevelCopy {
  /** Objective text by objective id. */
  objectives?: Record<string, string>;
  /** Walkthrough captions, in beat order. */
  beats?: readonly string[];
}

/** Arabic level copy. English lives in the level files themselves. */
export const AR_LEVELS: Record<LevelId, ArabicLevel> = {
  1: {
    title: "تعرّف على شبكتك",
    summary: "حاسوب واحد وموجّه واحد. أرسل ping إلى البوابة.",
    objectives: { "ping-router": "أرسل ping إلى الموجّه على 10.0.0.1 وشاهد ردًا أخضر." },
    beats: [
      "هذه شبكة صغيرة جدًا. أنت الحاسوب على اليسار.",
      "الصندوق على اليمين موجّه. إنه الباب إلى الشبكات الأخرى. عنوانه IP هو 10.0.0.1.",
      "أمر ping تحية صغيرة. شاهد تحية تذهب إلى الموجّه ثم تعود.",
      "الأخضر يعني أن الجهاز أجاب. الآن جرّب أنت: ping 10.0.0.1",
    ],
  },
  2: {
    title: "اعثر على جار",
    summary: "ينضم حاسوب ثانٍ إلى الشبكة المحلية. استخدم arp-scan لمعرفة عنوانه IP وMAC.",
    objectives: {
      "find-alice": "شغّل arp-scan --local واحفظ جهاز Alice في السجل.",
      "ping-alice": "أرسل ping إلى Alice باستخدام العنوان IP الذي وجدته.",
    },
    beats: [
      "الأجهزة القديمة ما زالت هنا. الشبكات تكبر ولا تبدأ من الصفر.",
      "انضمت جارة اسمها Alice إلى الشبكة المحلية نفسها. تراها على الخريطة، لكنك ما زلت تحتاج إلى عناوينها.",
      "يسأل arp-scan كل من حولك: ما عنوانك IP وما عنوانك MAC (معرّف العتاد)؟",
      "جرّب arp-scan --local. ثم أرسل ping إلى Alice باستخدام العنوان الذي تجده.",
    ],
  },
  3: {
    title: "ارسم خريطة الشبكة كاملة",
    summary: "تظهر أجهزة أكثر. املأ السجل ثم أرسل ping إلى جهاز اكتشفته.",
    objectives: { "map-lan": "اكتشف Bob والطابعة، ثم أرسل ping إلى الطابعة." },
    beats: [
      "كبرت الشبكة المحلية مجددًا. انضم Bob وطابعة إلى Alice والموجّه.",
      "الاستطلاع الجيد يعني قائمة كاملة: كل عنوان IP تستطيع إثبات وجوده.",
      "شاهد تحية واحدة تزور Bob. لاحقًا ستفحص الجميع باستخدام arp-scan.",
      "استخدم arp-scan --local، ثم ping 10.0.0.40. المهارات القديمة ما زالت تعمل.",
    ],
  },
  4: {
    title: "اطرق الأبواب",
    summary: "تعرّف على nmap. المنافذ المفتوحة ترد، والمغلقة ترسل RST.",
    objectives: { "scan-web": "افحص 10.0.0.50 واعرف أن المنفذ 80 مفتوح." },
    beats: [
      "انضم خادم ويب إلى الشبكة على 10.0.0.50. أمر ping يخبرك فقط أنه مستيقظ.",
      "المنافذ أبواب مرقّمة. شاهد تحية خضراء على المنفذ 80 (الويب).",
      "والآن باب مغلق. المنفذ 22 يرفض بإرسال RST. تتحول الحزمة إلى الأحمر.",
      "دورك: nmap -p 22,80 10.0.0.50  انقر على أي حزمة لإيقافها مؤقتًا وقراءتها.",
    ],
  },
  5: {
    title: "سمِّ الخدمات",
    summary: "للمنافذ المفتوحة وظائف: HTTP وSSH وغيرها. احفظ الأسماء في السجل.",
    objectives: { "name-services": "اعثر على HTTP وSSH في خادم الويب." },
    beats: [
      "خادم الويب نفسه يُظهر الآن أبوابًا أكثر. اسم الخدمة يخبرك بالوظيفة.",
      "المنفذ 443 هو HTTPS: باب ويب أكثر أمانًا. شاهد إجابة خضراء.",
      "المنفذ 22 هو SSH: باب للدخول عن بُعد. لدى Alice أيضًا SSH.",
      "افحص خادم الويب باستخدام nmap -p 21,22,80,443 10.0.0.50 واقرأ الأسماء.",
    ],
  },
  6: {
    title: "شبكة فرعية ثانية",
    summary: "خلف الموجّه الآن شبكة أخرى. افحص الجهتين.",
    objectives: { "other-subnet": "اكتشف الخادمين على 10.0.1.0/24 باستخدام nmap." },
    beats: [
      "يقف الموجّه الآن في المنتصف. على اليسار شبكتك المحلية، وعلى اليمين شبكة خوادم جديدة.",
      "الحزم المتجهة إلى 10.0.1.10 تقفز: منك، ثم إلى الموجّه، ثم إلى خادم الويب.",
      "يرى arp-scan الجيران المحليين على 10.0.0.x فقط. يصل ping إلى الخوادم البعيدة، لكن nmap وحده يكشف هويتها.",
      "امسح شبكة الخوادم: nmap -sn 10.0.1.0/24. واستمر في استخدام عناوين الشبكة القديمة أيضًا.",
    ],
  },
  7: {
    title: "الجدار الناري الصامت",
    summary: "المنافذ المُرشَّحة لا ترسل RST بل تنتهي مهلتها. راقب الحزم الكهرمانية.",
    objectives: { "see-filter": "اعرف أن المنفذ 80 مفتوح وأن المنفذ 22 مُرشَّح على 10.0.1.10." },
    beats: [
      "يقف جدار ناري الآن أمام الخوادم. يستطيع إسقاط الحزم دون أي رد.",
      "المنفذ 80 في خادم الويب ما زال يجيب. مسار أخضر.",
      "المنفذ 22 مُرشَّح. لا RST. تنتظر الحزمة ثم تنتهي مهلتها باللون الكهرماني.",
      "افحص 10.0.1.10 باستخدام nmap -p 22,80,3389. الصمت أيضًا دليل.",
    ],
  },
  8: {
    title: "صامت لكنه حي",
    summary: "جهاز يتجاهل ping لكن لديه منفذ مفتوح. الاكتشاف أكثر من مجرد ping.",
    objectives: { "quiet-host": "اعثر على الجهاز الصامت وأثبت أن المنفذ 80 مفتوح." },
    beats: [
      "جهاز جديد في شبكتك المحلية على 10.0.0.77. أرسل إليه ping أثناء العرض. يبقى صامتًا.",
      "صمت ping لا يعني أن المكان فارغ. شاهد طرقة على المنفذ 80 تحصل على رد أخضر.",
      "ما زال arp-scan قادرًا على إدراجه كجار. ثم استخدم nmap -p 80 10.0.0.77 لتثبت أنه حي.",
    ],
  },
  9: {
    title: "طابق الوظائف",
    summary: "خوادم الويب وDNS والملفات معًا. سمِّ كلًا منها حسب خدمته المفتوحة.",
    objectives: { roles: "اعثر على HTTP وDNS وFTP في الخوادم الثلاثة." },
    beats: [
      "ثلاثة خوادم تتشارك الجهة اليمنى. الصورة نفسها، والوظائف مختلفة.",
      "يستخدم DNS المنفذ 53. إنه يحوّل الأسماء إلى عناوين IP.",
      "يستخدم FTP المنفذ 21 للملفات. ويستخدم HTTP المنفذ 80 لصفحات الويب.",
      "افحص 10.0.1.10 و10.0.1.20 و10.0.1.53. طابق كل خدمة في السجل.",
    ],
  },
  10: {
    title: "استطلاع شامل",
    summary: "ثلاث شبكات فرعية. استخدم كل أداة. العناوين الخاطئة تتحرك أيضًا لتتعلم منها.",
    objectives: { "full-recon": "اكتشف خادم السجلات وخادم النسخ الاحتياطي، بما في ذلك LDAP وSSH." },
    beats: [
      "هذه خريطة التدريب الكاملة: الموظفون والخوادم والسجلات. كل ما تعلمته موجود هنا.",
      "حزمة متجهة إلى 10.0.2.15 تعبر الموجّه إلى شبكة السجلات الجديدة.",
      "جرّب عنوانًا خاطئًا مثل ping 10.9.9.9. سترى الحزمة تسير ثم تتوقف.",
      "ارسم خريطة الجيران المحليين، ثم افحص 10.0.2.15 و10.0.2.40. استعن بسجلك.",
    ],
  },
  11: { title: "أساسيات صياغة الحزم", summary: "ابنِ حزمًا بسيطة يدويًا وشاهد كيف تتغير الأعلام." },
  12: { title: "حكايات التوجيه", summary: "تتبّع حزمة عبر موجّهات كثيرة." },
  13: { title: "DNS على السلك", summary: "شاهد عمليات البحث عن الأسماء كحزم متحركة." },
  14: { title: "مسارات VPN", summary: "نفق يخفي المسار بين شبكتين." },
  15: { title: "استطلاع جماعي", summary: "شارك السجل مع مقعد تدريب ثانٍ." },
};

export function localizeLevel<T extends { id: LevelId; title: string; summary: string }>(level: T, language: Language): LevelCopy {
  const ar = language === "ar" ? AR_LEVELS[level.id] : undefined;
  return ar ? { title: ar.title, summary: ar.summary } : { title: level.title, summary: level.summary };
}

export function localizeObjective(level: LevelDefinition, objectiveId: string, language: Language): string {
  const english = level.objectives.find((o) => o.id === objectiveId)?.text ?? "";
  if (language !== "ar") return english;
  return AR_LEVELS[level.id]?.objectives?.[objectiveId] ?? english;
}

export function localizeBeat(level: LevelDefinition, index: number, language: Language): string | null {
  const english = level.walkthrough[index]?.text;
  if (english === undefined) return null;
  if (language !== "ar") return english;
  return AR_LEVELS[level.id]?.beats?.[index] ?? english;
}
