import type { PacketRequest } from "@/types/packet";
import type { NetworkDevice, PacketOutcome, Topology } from "@/types/topology";
import { routeHops } from "./routing";
import { serviceAbout, serviceName } from "./services";

export interface HeaderField {
  label: string;
  value: string;
  explain: string;
}

export type LayerId = "ethernet" | "arp" | "ip" | "icmp" | "tcp";

export interface HeaderLayer {
  id: LayerId;
  title: string;
  /** What this layer is for, in one line. */
  role: string;
  fields: HeaderField[];
}

export interface RouteStop {
  id: string;
  name: string;
  ip: string;
}

export interface PacketAnatomy {
  summary: string;
  route: RouteStop[];
  /** True when the packet never reached a device that owns the address. */
  dropped: boolean;
  request: HeaderLayer[];
  /** What came back. Null when nothing did (timeouts, lost knocks, unanswered ARP). */
  reply: HeaderLayer[] | null;
  verdict: { outcome: PacketOutcome; title: string; explain: string };
}

export type AnatomyLanguage = "en" | "ar";

const BROADCAST_MAC = "ff:ff:ff:ff:ff:ff";
const UNKNOWN_MAC = "00:00:00:00:00:00";

/** Every human-readable word the X-Ray shows. Header values stay technical in both languages. */
const COPY = {
  en: {
    everyone: "everyone",
    eth: {
      role: "The envelope for one cable hop. MAC addresses are hardware names.",
      srcMac: "Source MAC",
      dstMac: "Destination MAC",
      type: "Type",
      srcMacExplain: (name: string) => `${name}'s network card.`,
      broadcast: "All f's means everyone on the LAN hears it.",
      nextHop: (name: string) => `The next device on the path: ${name}.`,
      typeExplain: "What is inside this envelope.",
    },
    ip: {
      role: "The address label. Routers read it to pass the packet along.",
      srcIp: "Source IP",
      srcIpExplain: "Who sent it, so the answer can find its way back.",
      dstIp: "Destination IP",
      dstIpExplain: "Where it is trying to go.",
      ttl: "TTL",
      ttlExplain: "Time to live. Each router takes 1 off, so lost packets cannot loop forever.",
      protocol: "Protocol",
      protocolExplain: "Which kind of message is inside.",
    },
    arp: {
      summary: (src: string, ip: string) => `${src} calls out to the whole LAN: "Who has ${ip}?"`,
      role: "Asks which hardware (MAC) owns an IP on this LAN. It never crosses a router.",
      replyRole: "The answer to the question.",
      operation: "Operation",
      request: "1 (request)",
      requestExplain: "A question: who has this IP?",
      reply: "2 (reply)",
      replyExplain: "An answer: I have it!",
      senderMac: "Sender MAC",
      senderMacAsk: "Who is asking.",
      senderMacReply: (name: string) => `${name}'s hardware name. Now we know it.`,
      senderIp: "Sender IP",
      senderIpAsk: "The asker's IP, so the answer can come back.",
      senderIpReply: "The IP that was asked about.",
      targetMac: "Target MAC",
      targetMacAsk: "All zeros: this is what we want to learn.",
      targetMacReply: "Sent straight back to the asker.",
      targetIp: "Target IP",
      targetIpAsk: "The IP we are asking about.",
      targetIpReply: "The asker's IP.",
      found: (ip: string, mac: string) => `${ip} is at ${mac}`,
      foundExplain: (name: string) => `${name} answered. It is your neighbor on this LAN.`,
      none: "Nobody answered",
      noneExplain: (ip: string) =>
        `No neighbor owns ${ip}. ARP questions stop at the router, so devices on other networks never hear them.`,
    },
    icmp: {
      summary: (src: string, ip: string) => `${src} asks ${ip}: "Are you there?"`,
      role: "Short control messages. Ping uses it to say hello.",
      type: "Type",
      code: "Code",
      codeExplain: "Extra detail about the type.",
      ident: "Identifier",
      identExplain: "Matches replies to this ping command.",
      seq: "Sequence",
      seqExplain: "Which hello this is: 1st, 2nd, 3rd...",
      echoRequest: "A hello that asks for an echo back.",
      echoReply: "The echo: yes, I am here.",
      unreachable: (name: string) => `${name} reports it could not deliver the hello.`,
      replyTitle: "Echo reply",
      replyExplain: (name: string) => `${name} answered. It is online.`,
      droppedTitle: (name: string) => `Dropped at ${name}`,
      droppedExplain: (ip: string) => `No device owns ${ip}, so there was nowhere to deliver it.`,
      quietTitle: "No reply",
      quietExplain: (target: string) => `The hello reached ${target}, but it stayed quiet. Some devices ignore ping on purpose.`,
    },
    tcp: {
      summary: (src: string, port: string, ip: string, about?: string) =>
        `${src} knocks on door ${port} of ${ip}${about ? `, used for ${about}` : ""}.`,
      role: "Reliable conversations between two doors (ports).",
      srcPort: "Source port",
      srcPortTemp: "A temporary door on the sender for this chat.",
      srcPortAnswer: "The door that answered.",
      dstPort: "Destination port",
      dstPortKnock: "The door being knocked on.",
      dstPortBack: "Back to the sender's temporary door.",
      flags: "Flags",
      seq: "Sequence",
      seqExplain: "A starting number so both sides can count the bytes.",
      ack: "Acknowledgment",
      ackExplain: "Their number plus one: I heard you.",
      syn: "SYN means: hello, can we talk?",
      synAck: "SYN-ACK means: yes, come in. The door is open.",
      rst: "RST means: no, go away. The door is closed.",
      openTitle: (port: number) => `Port ${port} is open`,
      openExplain: (name: string, about?: string) => `${name} answered the knock${about ? `. This door is for ${about}` : ""}.`,
      closedTitle: (port: number) => `Port ${port} is closed`,
      closedExplain: (name: string) => `${name} is awake but nothing listens behind this door.`,
      filteredTitle: (port: number) => `Port ${port} is filtered`,
      filteredExplain: "No answer at all. A firewall probably dropped the knock without saying anything.",
      droppedTitle: (name: string) => `Dropped at ${name}`,
      droppedExplain: (ip: string) => `No device owns ${ip}, so the knock never reached a door.`,
    },
  },
  ar: {
    everyone: "الجميع",
    eth: {
      role: "الظرف الخاص بقفزة واحدة على الكابل. عناوين MAC هي أسماء العتاد.",
      srcMac: "MAC المصدر",
      dstMac: "MAC الوجهة",
      type: "النوع",
      srcMacExplain: (name: string) => `بطاقة الشبكة في ${name}.`,
      broadcast: "كلها f تعني أن كل من في الشبكة المحلية يسمعها (بث عام).",
      nextHop: (name: string) => `الجهاز التالي على المسار: ${name}.`,
      typeExplain: "ما الذي يحمله هذا الظرف في داخله.",
    },
    ip: {
      role: "ملصق العنوان. تقرؤه الموجّهات لتمرير الحزمة.",
      srcIp: "IP المصدر",
      srcIpExplain: "من أرسلها، كي يجد الرد طريق العودة.",
      dstIp: "IP الوجهة",
      dstIpExplain: "المكان الذي تحاول الوصول إليه.",
      ttl: "TTL",
      ttlExplain: "مدة البقاء. كل موجّه يطرح 1، فلا تدور الحزم الضائعة إلى الأبد.",
      protocol: "البروتوكول",
      protocolExplain: "نوع الرسالة الموجودة في الداخل.",
    },
    arp: {
      summary: (src: string, ip: string) => `${src} ينادي الشبكة المحلية كلها: "من يملك ${ip}؟"`,
      role: "يسأل أي عتاد (MAC) يملك عنوان IP في هذه الشبكة المحلية. لا يعبر الموجّه أبدًا.",
      replyRole: "الإجابة عن السؤال.",
      operation: "العملية",
      request: "1 (طلب)",
      requestExplain: "سؤال: من يملك هذا العنوان؟",
      reply: "2 (رد)",
      replyExplain: "إجابة: أنا أملكه!",
      senderMac: "MAC المرسل",
      senderMacAsk: "من يسأل.",
      senderMacReply: (name: string) => `اسم العتاد الخاص بـ ${name}. الآن عرفناه.`,
      senderIp: "IP المرسل",
      senderIpAsk: "عنوان السائل، كي يعود إليه الجواب.",
      senderIpReply: "العنوان الذي سُئل عنه.",
      targetMac: "MAC الهدف",
      targetMacAsk: "كلها أصفار: هذا ما نريد معرفته.",
      targetMacReply: "يُرسل مباشرة إلى السائل.",
      targetIp: "IP الهدف",
      targetIpAsk: "العنوان الذي نسأل عنه.",
      targetIpReply: "عنوان السائل.",
      found: (ip: string, mac: string) => `${ip} موجود عند ${mac}`,
      foundExplain: (name: string) => `أجاب ${name}. إنه جارك في هذه الشبكة المحلية.`,
      none: "لم يُجب أحد",
      noneExplain: (ip: string) =>
        `لا يملك أي جار العنوان ${ip}. أسئلة ARP تتوقف عند الموجّه، فلا تسمعها الأجهزة في الشبكات الأخرى.`,
    },
    icmp: {
      summary: (src: string, ip: string) => `${src} يسأل ${ip}: "هل أنت هناك؟"`,
      role: "رسائل تحكم قصيرة. يستخدمها ping لإلقاء التحية.",
      type: "النوع",
      code: "الرمز",
      codeExplain: "تفصيل إضافي عن النوع.",
      ident: "المعرّف",
      identExplain: "يربط الردود بأمر ping هذا.",
      seq: "التسلسل",
      seqExplain: "رقم هذه التحية: الأولى، الثانية، الثالثة...",
      echoRequest: "تحية تطلب صدى يعود.",
      echoReply: "الصدى: نعم، أنا هنا.",
      unreachable: (name: string) => `يُبلغ ${name} أنه لم يستطع توصيل التحية.`,
      replyTitle: "رد الصدى",
      replyExplain: (name: string) => `أجاب ${name}. إنه متصل.`,
      droppedTitle: (name: string) => `أُسقطت عند ${name}`,
      droppedExplain: (ip: string) => `لا يوجد جهاز يملك ${ip}، فلم يكن هناك مكان لتوصيلها.`,
      quietTitle: "لا رد",
      quietExplain: (target: string) => `وصلت التحية إلى ${target} لكنه بقي صامتًا. بعض الأجهزة تتجاهل ping عمدًا.`,
    },
    tcp: {
      summary: (src: string, port: string, ip: string, about?: string) =>
        `${src} يطرق الباب ${port} في ${ip}${about ? `، المستخدم لـ ${about}` : ""}.`,
      role: "محادثات موثوقة بين بابين (منفذين).",
      srcPort: "منفذ المصدر",
      srcPortTemp: "باب مؤقت لدى المرسل لهذه المحادثة.",
      srcPortAnswer: "الباب الذي أجاب.",
      dstPort: "منفذ الوجهة",
      dstPortKnock: "الباب الذي يُطرق.",
      dstPortBack: "العودة إلى الباب المؤقت لدى المرسل.",
      flags: "الأعلام",
      seq: "التسلسل",
      seqExplain: "رقم بداية كي يعدّ الطرفان البايتات.",
      ack: "الإقرار",
      ackExplain: "رقمهم زائد واحد: لقد سمعتك.",
      syn: "SYN تعني: مرحبًا، هل يمكننا التحدث؟",
      synAck: "SYN-ACK تعني: نعم، تفضّل. الباب مفتوح.",
      rst: "RST تعني: لا، انصرف. الباب مغلق.",
      openTitle: (port: number) => `المنفذ ${port} مفتوح`,
      openExplain: (name: string, about?: string) => `أجاب ${name} عن الطرقة${about ? `. هذا الباب مخصص لـ ${about}` : ""}.`,
      closedTitle: (port: number) => `المنفذ ${port} مغلق`,
      closedExplain: (name: string) => `${name} مستيقظ لكن لا شيء يستمع خلف هذا الباب.`,
      filteredTitle: (port: number) => `المنفذ ${port} مُرشَّح`,
      filteredExplain: "لا إجابة إطلاقًا. على الأرجح أسقط جدار ناري الطرقة دون أن يقول شيئًا.",
      droppedTitle: (name: string) => `أُسقطت عند ${name}`,
      droppedExplain: (ip: string) => `لا يوجد جهاز يملك ${ip}، فلم تصل الطرقة إلى أي باب.`,
    },
  },
} as const;

type Copy = (typeof COPY)[AnatomyLanguage];

/** Stable pseudo-random number from a string, for sequence numbers that should not change on re-render. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function portLabel(port: number): string {
  const name = serviceName(port);
  return name ? `${port} (${name})` : String(port);
}

function ethernet(c: Copy, src: NetworkDevice, dstMac: string, dstName: string, carries: string): HeaderLayer {
  return {
    id: "ethernet",
    title: "Ethernet",
    role: c.eth.role,
    fields: [
      { label: c.eth.srcMac, value: src.mac, explain: c.eth.srcMacExplain(src.name) },
      {
        label: c.eth.dstMac,
        value: dstMac,
        explain: dstMac === BROADCAST_MAC ? c.eth.broadcast : c.eth.nextHop(dstName),
      },
      { label: c.eth.type, value: carries, explain: c.eth.typeExplain },
    ],
  };
}

function ipLayer(c: Copy, srcIp: string, dstIp: string, ttl: number, protocol: "ICMP (1)" | "TCP (6)"): HeaderLayer {
  return {
    id: "ip",
    title: "IPv4",
    role: c.ip.role,
    fields: [
      { label: c.ip.srcIp, value: srcIp, explain: c.ip.srcIpExplain },
      { label: c.ip.dstIp, value: dstIp, explain: c.ip.dstIpExplain },
      { label: c.ip.ttl, value: String(ttl), explain: c.ip.ttlExplain },
      { label: c.ip.protocol, value: protocol, explain: c.ip.protocolExplain },
    ],
  };
}

export function describePacket(
  packet: PacketRequest & { id?: string },
  topology: Topology,
  language: AnatomyLanguage = "en",
): PacketAnatomy {
  const c: Copy = COPY[language];
  const byId = new Map(topology.devices.map((d) => [d.id, d]));
  const src = byId.get(packet.srcId) ?? topology.devices[0];
  const dst = packet.dstId ? byId.get(packet.dstId) : undefined;
  const dstIp = packet.dstIp ?? dst?.ip ?? "?";

  const hopIds = routeHops(topology, packet.srcId, packet.dstId);
  const hops = hopIds.map((id) => byId.get(id)).filter((d): d is NetworkDevice => d !== undefined);
  const route = hops.map((d) => ({ id: d.id, name: d.name, ip: d.ip }));
  const next = hops[1] ?? src;
  const last = hops[hops.length - 1] ?? src;
  const routers = Math.max(0, hops.length - 2);
  const replyTtl = 64 - routers;
  const dropped = packet.outcome === "unreachable";
  const seed = hash(`${packet.id ?? ""}${packet.srcPort ?? ""}${packet.dstPort ?? ""}${packet.seq ?? ""}`);

  let summary: string;
  let request: HeaderLayer[];
  let reply: HeaderLayer[] | null = null;
  let verdict: PacketAnatomy["verdict"];

  if (packet.protocol === "arp") {
    summary = c.arp.summary(src.name, dstIp);
    request = [
      ethernet(c, src, BROADCAST_MAC, c.everyone, "ARP (0x0806)"),
      {
        id: "arp",
        title: "ARP",
        role: c.arp.role,
        fields: [
          { label: c.arp.operation, value: c.arp.request, explain: c.arp.requestExplain },
          { label: c.arp.senderMac, value: src.mac, explain: c.arp.senderMacAsk },
          { label: c.arp.senderIp, value: src.ip, explain: c.arp.senderIpAsk },
          { label: c.arp.targetMac, value: UNKNOWN_MAC, explain: c.arp.targetMacAsk },
          { label: c.arp.targetIp, value: dstIp, explain: c.arp.targetIpAsk },
        ],
      },
    ];
    if (packet.outcome === "success" && dst) {
      reply = [
        ethernet(c, dst, src.mac, src.name, "ARP (0x0806)"),
        {
          id: "arp",
          title: "ARP",
          role: c.arp.replyRole,
          fields: [
            { label: c.arp.operation, value: c.arp.reply, explain: c.arp.replyExplain },
            { label: c.arp.senderMac, value: dst.mac, explain: c.arp.senderMacReply(dst.name) },
            { label: c.arp.senderIp, value: dstIp, explain: c.arp.senderIpReply },
            { label: c.arp.targetMac, value: src.mac, explain: c.arp.targetMacReply },
            { label: c.arp.targetIp, value: src.ip, explain: c.arp.targetIpReply },
          ],
        },
      ];
      verdict = { outcome: "success", title: c.arp.found(dstIp, dst.mac), explain: c.arp.foundExplain(dst.name) };
    } else {
      verdict = { outcome: packet.outcome, title: c.arp.none, explain: c.arp.noneExplain(dstIp) };
    }
  } else if (packet.protocol === "icmp") {
    const seq = packet.seq ?? 1;
    const ident = (seed % 60000) + 1000;
    summary = c.icmp.summary(src.name, dstIp);
    const icmp = (type: string, explain: string): HeaderLayer => ({
      id: "icmp",
      title: "ICMP",
      role: c.icmp.role,
      fields: [
        { label: c.icmp.type, value: type, explain },
        { label: c.icmp.code, value: type.startsWith("3") ? "1 (host unreachable)" : "0", explain: c.icmp.codeExplain },
        { label: c.icmp.ident, value: String(ident), explain: c.icmp.identExplain },
        { label: c.icmp.seq, value: String(seq), explain: c.icmp.seqExplain },
      ],
    });
    request = [
      ethernet(c, src, next.mac, next.name, "IPv4 (0x0800)"),
      ipLayer(c, src.ip, dstIp, 64, "ICMP (1)"),
      icmp("8 (echo request)", c.icmp.echoRequest),
    ];
    if (packet.outcome === "success" && dst) {
      reply = [
        ethernet(c, next, src.mac, src.name, "IPv4 (0x0800)"),
        ipLayer(c, dstIp, src.ip, replyTtl, "ICMP (1)"),
        icmp("0 (echo reply)", c.icmp.echoReply),
      ];
      verdict = { outcome: "success", title: c.icmp.replyTitle, explain: c.icmp.replyExplain(dst.name) };
    } else if (packet.outcome === "unreachable") {
      reply = [
        ethernet(c, last, src.mac, src.name, "IPv4 (0x0800)"),
        ipLayer(c, last.ip, src.ip, 64, "ICMP (1)"),
        icmp("3 (destination unreachable)", c.icmp.unreachable(last.name)),
      ];
      verdict = { outcome: "unreachable", title: c.icmp.droppedTitle(last.name), explain: c.icmp.droppedExplain(dstIp) };
    } else {
      verdict = { outcome: packet.outcome, title: c.icmp.quietTitle, explain: c.icmp.quietExplain(dst?.name ?? dstIp) };
    }
  } else {
    const dport = packet.dstPort ?? 0;
    const sport = packet.srcPort ?? 49152 + (seed % 16000);
    const isn = seed % 4294967295;
    const about = serviceAbout(dport, language);
    summary = c.tcp.summary(src.name, portLabel(dport), dstIp, about);
    const tcp = (from: number, to: number, flags: string, explain: string, seq: number, ack?: number): HeaderLayer => ({
      id: "tcp",
      title: "TCP",
      role: c.tcp.role,
      fields: [
        {
          label: c.tcp.srcPort,
          value: from === dport ? portLabel(from) : String(from),
          explain: from === sport ? c.tcp.srcPortTemp : c.tcp.srcPortAnswer,
        },
        {
          label: c.tcp.dstPort,
          value: to === dport ? portLabel(to) : String(to),
          explain: to === dport ? c.tcp.dstPortKnock : c.tcp.dstPortBack,
        },
        { label: c.tcp.flags, value: flags, explain },
        { label: c.tcp.seq, value: String(seq), explain: c.tcp.seqExplain },
        ...(ack !== undefined ? [{ label: c.tcp.ack, value: String(ack), explain: c.tcp.ackExplain }] : []),
      ],
    });
    request = [
      ethernet(c, src, next.mac, next.name, "IPv4 (0x0800)"),
      ipLayer(c, src.ip, dstIp, 64, "TCP (6)"),
      tcp(sport, dport, "SYN", c.tcp.syn, isn),
    ];
    const replyHeaders = (flags: string, explain: string) => [
      ethernet(c, next, src.mac, src.name, "IPv4 (0x0800)"),
      ipLayer(c, dstIp, src.ip, replyTtl, "TCP (6)" as const),
      tcp(dport, sport, flags, explain, flags.startsWith("RST") ? 0 : (seed >>> 3) % 4294967295, (isn + 1) % 4294967296),
    ];
    if (packet.outcome === "success" && dst) {
      reply = replyHeaders("SYN, ACK", c.tcp.synAck);
      verdict = { outcome: "success", title: c.tcp.openTitle(dport), explain: c.tcp.openExplain(dst.name, about) };
    } else if (packet.outcome === "rst" && dst) {
      reply = replyHeaders("RST, ACK", c.tcp.rst);
      verdict = { outcome: "rst", title: c.tcp.closedTitle(dport), explain: c.tcp.closedExplain(dst.name) };
    } else if (packet.outcome === "timeout") {
      verdict = { outcome: "timeout", title: c.tcp.filteredTitle(dport), explain: c.tcp.filteredExplain };
    } else {
      verdict = { outcome: packet.outcome, title: c.tcp.droppedTitle(last.name), explain: c.tcp.droppedExplain(dstIp) };
    }
  }

  return { summary, route, dropped, request, reply, verdict };
}
