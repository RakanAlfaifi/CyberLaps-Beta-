import type { ToolInfo } from "@/core/tools/catalog";
import type { Language } from "./translate";

/** The words a tool says about itself. Name, syntax, tokens and example stay as typed in the terminal. */
type ToolCopy = Pick<ToolInfo, "purpose" | "greeting" | "howItWorks" | "tip" | "summary"> & {
  /** Meaning of each syntax part, keyed by its token. */
  parts: Record<string, string>;
};

/** Arabic tool guides. English lives in `src/content/tools/catalog.json`. */
export const AR_TOOLS: Record<string, ToolCopy> = {
  ping: {
    purpose: "اسأل جهازًا: هل أنت متصل؟",
    greeting: "مرحبًا، أنا ping. أطرح على جهاز واحد سؤالًا بسيطًا: هل أنت متصل؟",
    howItWorks: [
      "أرسل حزمة تحية صغيرة إلى العنوان الذي تعطيني إياه.",
      "إذا كان الجهاز مستيقظًا، يرسل تحية في المقابل. تتحول الحزمة إلى الأخضر.",
      "إذا لم يُجب أحد، تتحول الحزمة إلى الكهرماني. قد يكون الجهاز مطفأً أو صامتًا، أو قد يكون العنوان خاطئًا.",
    ],
    parts: {
      ping: "اسمي. يخبر الطرفية أن تستدعيني.",
      "<ip-address>": "الجهاز الذي ستسأله، مثل 10.0.0.1.",
    },
    tip: "تريد تحيات أقل؟ أضف -c ورقمًا: ping -c 2 10.0.0.1",
    summary:
      "يرسل ping رسالة اختبار صغيرة. إذا أجاب الجهاز فهو مستيقظ. وإذا لم يُجب، فقد يكون مطفأً أو مخفيًا أو أن العنوان خاطئ. راقب الحزمة المتحركة لترى أين تذهب الرسالة.",
  },
  "arp-scan": {
    purpose: "اعثر على الجيران في شبكتك المحلية.",
    greeting: "مرحبًا، أنا arp-scan. أعثر على جيرانك: كل جهاز في شبكتك الصغيرة.",
    howItWorks: [
      "أطرح على كل من حولك السؤال نفسه: من يملك هذا العنوان؟",
      "يجيب كل جار بعنوانه IP وعنوانه MAC (معرّف العتاد).",
      "أحفظ كل من يجيب في سجل الاستطلاع. لا أستطيع الرؤية خلف الموجّه.",
    ],
    parts: {
      "arp-scan": "اسمي. يخبر الطرفية أن تستدعيني.",
      "--local": "اسأل كل جهاز في شبكتك المحلية.",
    },
    tip: "أصل إلى شبكتك المحلية فقط. للأجهزة خلف الموجّه استخدم ping.",
    summary:
      "تسأل هذه الأداة: من بجواري في هذه الشبكة الصغيرة نفسها؟ تتعلم عنوان IP وعنوان MAC لكل جار (معرّف عتاد الجهاز). لا تستطيع وحدها رؤية الأجهزة في شبكة فرعية بعيدة.",
  },
  nmap: {
    purpose: "تحقق من الأبواب (المنافذ) المفتوحة في جهاز.",
    greeting: "مرحبًا، أنا nmap. أطرق أبواب الجهاز، وتُسمى المنافذ، لأرى أيها يُفتح.",
    howItWorks: [
      "أولًا أتحقق من أن الجهاز مستيقظ.",
      "ثم أطرق كل منفذ تذكره. الأخضر يعني مفتوح: هناك خدمة تستمع.",
      "الأحمر يعني مغلق: قال الجهاز لا (RST). الكهرماني يعني مُرشَّح: لا إجابة إطلاقًا، وغالبًا بسبب جدار ناري.",
    ],
    parts: {
      nmap: "اسمي. يخبر الطرفية أن تستدعيني.",
      "-p <ports>": "الأبواب التي سأطرقها، مفصولة بفواصل، مثل -p 22,80.",
      "<ip-address>": "الجهاز الذي سأفحصه.",
    },
    tip: "انقر على أي حزمة متحركة لتجميد الوقت وقراءة ترويساتها.",
    summary:
      "المنفذ مثل باب مرقّم. مفتوح يعني أن خدمة تستمع. مغلق يعني أن الجهاز قال لا (RST). مُرشَّح يعني لا إجابة واضحة (غالبًا جدار ناري). انقر على حزمة لإيقافها وقراءة الترويسات.",
  },
};

export function localizeTool(tool: ToolInfo, language: Language): ToolInfo {
  const ar = language === "ar" ? AR_TOOLS[tool.id] : undefined;
  if (!ar) return tool;
  return {
    ...tool,
    purpose: ar.purpose,
    greeting: ar.greeting,
    howItWorks: ar.howItWorks,
    tip: ar.tip ?? tool.tip,
    summary: ar.summary,
    parts: tool.parts.map((part) => ({ ...part, meaning: ar.parts[part.token] ?? part.meaning })),
  };
}
