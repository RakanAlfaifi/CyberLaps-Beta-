import type { LevelId } from "@/types/level";
import type { Language } from "./translate";

export type LessonSection = "packet" | "protocol" | "defense";

export const LESSON_SECTIONS: readonly LessonSection[] = ["packet", "protocol", "defense"];

/** One level's deeper reading: each section is a short list of points. */
export type Lesson = Record<LessonSection, readonly string[]>;

const EN: Record<LevelId, Lesson> = {
  1: {
    packet: [
      "A ping travels in three nested layers: an Ethernet frame (MAC addresses, good for one cable hop), an IPv4 header (source and destination IP, TTL, protocol number 1), and the ICMP message itself.",
      "The ICMP part is tiny: Type (8 = echo request, 0 = echo reply), Code, an Identifier that ties replies to your ping command, and a Sequence number that counts each hello.",
      "\"56(84) bytes of data\" means 56 bytes of payload + 8 bytes of ICMP header + 20 bytes of IPv4 header = 84 bytes at the IP layer.",
    ],
    protocol: [
      "ping sends one echo request at a time and waits for a matching echo reply. Matching Identifier and Sequence numbers let it measure the round-trip time (the time= value).",
      "A reply only proves the device's network stack is alive. It says nothing about which services run on it.",
      "The TTL in the reply hints at distance: most systems start at 64 or 128, and every router on the way subtracts 1.",
    ],
    defense: [
      "One host pinging many addresses in a short window (a ping sweep) is a classic early sign of reconnaissance. Network monitoring tools flag it.",
      "Many organizations rate-limit or block inbound ICMP echo at the internet edge but allow it internally, because it is so useful for troubleshooting.",
      "Keep a baseline of which hosts normally answer. A new device that suddenly replies is worth a closer look.",
    ],
  },
  2: {
    packet: [
      "ARP sits directly inside an Ethernet frame (EtherType 0x0806). There is no IP header at all.",
      "The request goes to the broadcast MAC ff:ff:ff:ff:ff:ff and carries the sender's MAC and IP plus the target IP. The target MAC is all zeros, because that is the unknown.",
      "The reply is sent straight back (unicast) with the missing MAC filled in.",
    ],
    protocol: [
      "Before a computer can send any IP packet on a LAN, it needs the next device's MAC address. ARP asks for it and stores the answer in the ARP cache for a few minutes.",
      "ARP has no authentication: any device may answer, and hosts usually believe the latest reply.",
      "Broadcasts stay inside one layer-2 segment, so ARP never crosses a router. That is why arp-scan only sees your own LAN.",
    ],
    defense: [
      "Because ARP trusts every answer, an attacker can send forged replies (ARP spoofing) to sit in the middle of other people's traffic.",
      "Defenses include Dynamic ARP Inspection on managed switches, static ARP entries for critical gateways, and alerts when one IP suddenly maps to a new MAC.",
      "A burst of ARP requests for every address in a subnet, from one host, is the fingerprint of an ARP scan.",
    ],
  },
  3: {
    packet: [
      "Every ARP reply in a scan carries one IP and MAC pair. Together they form your first inventory of the LAN.",
      "The first three bytes of a MAC (the OUI) identify the hardware vendor, which often hints at the device type: printer, phone, PC, or camera.",
      "A ping reply adds layer-3 proof: the device not only exists on the wire, its IP stack also answers.",
    ],
    protocol: [
      "arp-scan sends one request for every address in the subnet (254 of them in a /24) and lists whoever answers. Silent addresses simply never reply.",
      "Combining arp-scan (who is physically here) with ping (who answers at the IP layer) gives a more reliable host list than either tool alone.",
      "Re-running a scan is cheap, so comparing results over time is a fast way to see what changed.",
    ],
    defense: [
      "Asset inventory is the first control in most security frameworks: you cannot protect what you do not know exists.",
      "Compare scans against the official inventory. An unknown MAC, such as an unmanaged printer or a rogue access point, should trigger an investigation.",
      "Printers and IoT devices often run old firmware and are rarely patched, which makes them popular entry points for attackers.",
    ],
  },
  4: {
    packet: [
      "A TCP header holds a source port and a destination port (16 bits each, 0 to 65535), sequence and acknowledgment numbers, and flag bits such as SYN, ACK, RST and FIN.",
      "nmap's default scan sends a single SYN segment to each port and reads which flags come back.",
      "Open X-Ray on a knock: the request carries only SYN; an open port answers SYN, ACK and a closed one answers RST, ACK.",
    ],
    protocol: [
      "A normal TCP connection starts with a three-way handshake: SYN from the client, SYN-ACK from the server, then ACK from the client.",
      "A SYN scan is \"half-open\": after a SYN-ACK it sends RST instead of the final ACK, so a full connection is never made.",
      "A closed port answers immediately with RST. The device is alive, but nothing listens behind that door.",
    ],
    defense: [
      "SYNs to many ports from one source within seconds, with almost no completed handshakes, is the signature of a port scan. Intrusion detection systems such as Snort or Suricata alert on it.",
      "Every open port is attack surface. Close or uninstall services you do not need.",
      "Configure firewalls as default-deny for inbound traffic and allow only the services the business really needs.",
    ],
  },
  5: {
    packet: [
      "Port numbers are conventions: well-known ports 0 to 1023 (22 SSH, 80 HTTP, 443 HTTPS), registered ports 1024 to 49151, and ephemeral ports 49152 to 65535 that clients pick as temporary source ports.",
      "The SERVICE column in nmap is a guess from the port number. A real service could be listening on any port, which is why version detection exists.",
      "The source port in your SYN is random each scan; the destination port is the door you chose.",
    ],
    protocol: [
      "HTTP on port 80 sends plain text. HTTPS on port 443 wraps the same HTTP inside TLS, so the content is encrypted and the server proves its identity with a certificate.",
      "SSH on port 22 gives an encrypted remote shell. FTP (21) and Telnet (23) send usernames and passwords in clear text.",
      "One server often runs several services, and each one is a separate door that needs its own protection.",
    ],
    defense: [
      "Service inventory drives patching and hardening: every listening service needs an owner, a known version, and a reason to exist.",
      "Prefer encrypted protocols (HTTPS, SSH, SFTP) and disable legacy cleartext ones.",
      "Restrict SSH to management networks, require keys instead of passwords, and watch for bursts of failed logins that signal brute-force attempts.",
    ],
  },
  6: {
    packet: [
      "When a packet goes to another subnet, the IP addresses stay end to end (you to the web server), but the Ethernet destination MAC is the router's.",
      "At each hop the router writes a fresh Ethernet header and lowers the TTL by 1. That is why replies from the server LAN arrive with ttl=63 instead of 64.",
      "Compare two X-Rays: a LAN ping and a routed ping have the same ICMP part but different MACs and TTLs.",
    ],
    protocol: [
      "A host compares the destination with its subnet mask (/24 means 255.255.255.0). Same network: ARP for the host directly. Different network: send it to the default gateway.",
      "Routers forward packets between subnets using their routing tables. They do not forward broadcasts such as ARP.",
      "That is why far devices need ping or nmap: only IP-level tools can cross the router.",
    ],
    defense: [
      "Segmentation limits the blast radius: with staff PCs and servers on separate subnets, the router or firewall decides which traffic may cross.",
      "Apply access control lists so only the required ports reach the server LAN.",
      "Watch for internal hosts suddenly probing other subnets. Lateral movement after a compromise often looks exactly like this level.",
    ],
  },
  7: {
    packet: [
      "A filtered knock has no reply packet at all. The X-Ray shows only what was sent and an empty \"what came back\".",
      "Some firewalls return an ICMP type 3 \"administratively prohibited\" message instead. nmap reports that as filtered too.",
      "Compare with a closed port: there a real RST packet comes back from the server itself.",
    ],
    protocol: [
      "Firewalls can drop (silently discard) or reject (send back RST or ICMP). Dropping forces the scanner to wait for a timeout and retry, which makes scans slower and less certain.",
      "nmap uses three states: open (SYN-ACK came back), closed (RST came back), filtered (nothing came back, or ICMP unreachable).",
      "Filtered does not mean empty. A service may be running behind the firewall, just not reachable from where you stand.",
    ],
    defense: [
      "Default-deny with drop at the perimeter gives attackers as little information as possible.",
      "Firewall logs of dropped packets are valuable: repeated drops from one source across many ports point to scanning.",
      "Test your own rules by scanning from inside and outside, and document the expected state of every port so changes stand out.",
    ],
  },
  8: {
    packet: [
      "This host drops ICMP echo requests, but its TCP stack still answers a SYN on port 80 with SYN-ACK.",
      "On the LAN it must answer ARP to communicate at all, so it cannot hide at layer 2.",
      "Two X-Rays tell the story: an ICMP request with no reply, then a TCP knock with a full SYN-ACK.",
    ],
    protocol: [
      "nmap discovers hosts with several probes: ARP on the local LAN; off the LAN, an ICMP echo plus TCP probes to ports such as 80 and 443.",
      "The -Pn flag skips discovery and treats the host as up, so nmap knocks on the ports anyway.",
      "Blocking ping alone does not make a host invisible. Any open service is a way to find it.",
    ],
    defense: [
      "\"Security through obscurity\", such as only blocking ping, is weak. Assume every reachable service will be found.",
      "Reduce exposed services instead, and monitor the ones that must stay open.",
      "Network access control (802.1X) and switch port monitoring catch unknown devices that answer ARP, even if they ignore ping.",
    ],
  },
  9: {
    packet: [
      "DNS usually answers queries over UDP port 53 and uses TCP 53 for large answers and zone transfers. In this lab you knock on TCP 53.",
      "FTP uses TCP 21 for commands and opens a separate connection for the file data.",
      "HTTP requests are readable text lines such as \"GET / HTTP/1.1\" followed by headers, which is why plain HTTP traffic is easy to read on the wire.",
    ],
    protocol: [
      "DNS turns names into IP addresses. Almost every connection starts with a DNS lookup, so DNS logs become a timeline of what each host tried to reach.",
      "FTP sends usernames and passwords without encryption.",
      "Identifying each server's role builds a map of what the organization depends on: web, name resolution, and file storage.",
    ],
    defense: [
      "DNS servers should refuse zone transfers (AXFR) to arbitrary hosts. A transfer leaks the full list of internal names.",
      "Monitor DNS for unusual domains or very long random-looking names, which can mean tunneling or malware calling home.",
      "Replace FTP with SFTP or FTPS, and place public-facing servers in a DMZ that is separated from internal data.",
    ],
  },
  10: {
    packet: [
      "Across three subnets you have now seen every layer: Ethernet for one hop, IP headers that survive routing with the TTL dropping per router, ARP limited to the local segment, ICMP for reachability, and TCP flags revealing port state.",
      "A wrong address still produces packets: an ICMP \"destination unreachable\" from the router tells you the network exists but the host does not.",
      "Reading headers is how analysts reconstruct what happened from a packet capture.",
    ],
    protocol: [
      "A complete recon follows a method: discover local hosts (arp-scan), reach remote subnets (ping or nmap -sn), enumerate ports and services (nmap -p), then record everything in a ledger.",
      "LDAP (389) holds the directory of users and groups. Kerberos (88) handles logins in Windows domains.",
      "Backup servers often hold a copy of everything, which makes them as sensitive as the data they protect.",
    ],
    defense: [
      "Defenders run this same method on their own networks, with authorization, and compare the results with the official asset inventory.",
      "Directory and backup servers are crown jewels: restrict access to the hosts that need them, monitor every login, and keep backups offline or immutable so ransomware cannot reach them.",
      "Only scan networks you own or have written permission to test. The skills are the same; permission is what makes it defense.",
    ],
  },
};

const AR: Record<LevelId, Lesson> = {
  1: {
    packet: [
      "تنتقل حزمة ping في ثلاث طبقات متداخلة: إطار Ethernet (عناوين MAC، صالح لقفزة واحدة على الكابل)، وترويسة IPv4 (عنوان IP للمصدر والوجهة، وTTL، ورقم البروتوكول 1)، ثم رسالة ICMP نفسها.",
      "جزء ICMP صغير جدًا: النوع (8 = طلب صدى، 0 = رد صدى)، والرمز، والمعرّف الذي يربط الردود بأمر ping الخاص بك، ورقم التسلسل الذي يعدّ كل تحية.",
      "عبارة \"56(84) bytes of data\" تعني 56 بايت حمولة + 8 بايت ترويسة ICMP + 20 بايت ترويسة IPv4 = 84 بايت في طبقة IP.",
    ],
    protocol: [
      "يرسل ping طلب صدى واحدًا في كل مرة وينتظر رد صدى مطابقًا. تطابق المعرّف ورقم التسلسل يتيح له قياس زمن الذهاب والإياب (قيمة time=).",
      "الرد يثبت فقط أن مكدّس الشبكة في الجهاز يعمل. لا يقول شيئًا عن الخدمات التي تعمل عليه.",
      "قيمة TTL في الرد تلمّح إلى المسافة: تبدأ معظم الأنظمة من 64 أو 128، وكل موجّه في الطريق يطرح 1.",
    ],
    defense: [
      "جهاز واحد يرسل ping إلى عناوين كثيرة في وقت قصير (مسح ping) علامة كلاسيكية مبكرة على الاستطلاع، وتنبّه إليها أدوات مراقبة الشبكة.",
      "تحدّ مؤسسات كثيرة من طلبات صدى ICMP الواردة من الإنترنت أو تحظرها، لكنها تسمح بها داخليًا لأنها مفيدة جدًا في استكشاف الأعطال.",
      "احتفظ بخط أساس للأجهزة التي تجيب عادةً. الجهاز الجديد الذي يبدأ بالرد فجأة يستحق نظرة أقرب.",
    ],
  },
  2: {
    packet: [
      "يجلس ARP مباشرة داخل إطار Ethernet (نوع الإطار 0x0806). لا توجد ترويسة IP إطلاقًا.",
      "يُرسل الطلب إلى عنوان البث ff:ff:ff:ff:ff:ff ويحمل عنوان MAC وIP للمرسل مع عنوان IP المستهدف. عنوان MAC المستهدف كله أصفار لأنه المجهول.",
      "يُرسل الرد مباشرة إلى السائل (إرسال أحادي) وفيه عنوان MAC الناقص.",
    ],
    protocol: [
      "قبل أن يرسل الحاسوب أي حزمة IP في الشبكة المحلية، يحتاج إلى عنوان MAC للجهاز التالي. يسأل ARP عنه ويخزّن الإجابة في ذاكرة ARP المؤقتة لبضع دقائق.",
      "لا يملك ARP أي مصادقة: يستطيع أي جهاز أن يجيب، والأجهزة عادةً تصدّق آخر رد.",
      "يبقى البث داخل مقطع واحد من الطبقة الثانية، لذا لا يعبر ARP الموجّه أبدًا. لهذا لا يرى arp-scan إلا شبكتك المحلية.",
    ],
    defense: [
      "لأن ARP يصدّق كل إجابة، يستطيع المهاجم إرسال ردود مزوّرة (انتحال ARP) ليقف في منتصف حركة مرور الآخرين.",
      "من وسائل الدفاع: الفحص الديناميكي لـ ARP في المبدّلات المُدارة، وقيود ARP ثابتة للبوابات الحساسة، وتنبيهات عندما يرتبط عنوان IP فجأة بعنوان MAC جديد.",
      "دفعة من طلبات ARP لكل عنوان في الشبكة الفرعية، من جهاز واحد، هي بصمة مسح ARP.",
    ],
  },
  3: {
    packet: [
      "كل رد ARP في المسح يحمل زوجًا واحدًا من IP وMAC. معًا يشكّلان أول جرد لشبكتك المحلية.",
      "أول ثلاثة بايتات من عنوان MAC (رمز OUI) تحدد الشركة المصنّعة للعتاد، وغالبًا تلمّح إلى نوع الجهاز: طابعة أو هاتف أو حاسوب أو كاميرا.",
      "رد ping يضيف إثباتًا من الطبقة الثالثة: الجهاز ليس موجودًا على السلك فحسب، بل يجيب مكدّس IP فيه أيضًا.",
    ],
    protocol: [
      "يرسل arp-scan طلبًا لكل عنوان في الشبكة الفرعية (254 عنوانًا في ‎/24) ويُدرج كل من يجيب. العناوين الصامتة لا ترد ببساطة.",
      "الجمع بين arp-scan (من الموجود فعليًا هنا) وping (من يجيب في طبقة IP) يعطي قائمة أجهزة أدق من كل أداة وحدها.",
      "إعادة المسح غير مكلفة، لذا فمقارنة النتائج بمرور الوقت طريقة سريعة لمعرفة ما تغيّر.",
    ],
    defense: [
      "جرد الأصول هو الضابط الأول في معظم أطر الأمن: لا يمكنك حماية ما لا تعرف بوجوده.",
      "قارن نتائج المسح بالجرد الرسمي. عنوان MAC مجهول، مثل طابعة غير مُدارة أو نقطة وصول دخيلة، يجب أن يطلق تحقيقًا.",
      "الطابعات وأجهزة إنترنت الأشياء تعمل غالبًا ببرامج ثابتة قديمة ونادرًا ما تُحدَّث، مما يجعلها مداخل مفضلة للمهاجمين.",
    ],
  },
  4: {
    packet: [
      "تحمل ترويسة TCP منفذ المصدر ومنفذ الوجهة (16 بت لكل منهما، من 0 إلى 65535)، وأرقام التسلسل والإقرار، وبتات الأعلام مثل SYN وACK وRST وFIN.",
      "يرسل الفحص الافتراضي في nmap مقطع SYN واحدًا إلى كل منفذ ويقرأ الأعلام التي تعود.",
      "افتح الأشعة على طرقة: الطلب يحمل SYN فقط؛ المنفذ المفتوح يجيب بـ SYN, ACK والمغلق يجيب بـ RST, ACK.",
    ],
    protocol: [
      "يبدأ اتصال TCP العادي بمصافحة ثلاثية: SYN من العميل، ثم SYN-ACK من الخادم، ثم ACK من العميل.",
      "فحص SYN \"نصف مفتوح\": بعد SYN-ACK يرسل RST بدل ACK الأخيرة، فلا يكتمل الاتصال أبدًا.",
      "المنفذ المغلق يجيب فورًا بـ RST. الجهاز حي، لكن لا شيء يستمع خلف هذا الباب.",
    ],
    defense: [
      "رسائل SYN إلى منافذ كثيرة من مصدر واحد خلال ثوانٍ، مع شبه انعدام للمصافحات المكتملة، هي بصمة فحص المنافذ. أنظمة كشف التسلل مثل Snort أو Suricata تنبّه إليها.",
      "كل منفذ مفتوح سطح هجوم. أغلق الخدمات التي لا تحتاجها أو أزلها.",
      "اضبط الجدران النارية على الرفض الافتراضي لحركة المرور الواردة، واسمح فقط بالخدمات التي يحتاجها العمل فعلًا.",
    ],
  },
  5: {
    packet: [
      "أرقام المنافذ أعراف متفق عليها: المنافذ المعروفة من 0 إلى 1023 (‏22 لـ SSH و80 لـ HTTP و443 لـ HTTPS)، والمنافذ المسجّلة من 1024 إلى 49151، والمنافذ المؤقتة من 49152 إلى 65535 التي يختارها العميل كمنفذ مصدر مؤقت.",
      "عمود SERVICE في nmap تخمين من رقم المنفذ. قد تستمع خدمة حقيقية على أي منفذ، ولهذا يوجد كشف الإصدارات.",
      "منفذ المصدر في رسالة SYN عشوائي في كل فحص؛ أما منفذ الوجهة فهو الباب الذي اخترته.",
    ],
    protocol: [
      "يرسل HTTP على المنفذ 80 نصًا واضحًا. أما HTTPS على المنفذ 443 فيغلّف HTTP نفسه داخل TLS، فيصبح المحتوى مشفّرًا ويثبت الخادم هويته بشهادة.",
      "يوفر SSH على المنفذ 22 واجهة أوامر بعيدة مشفّرة. أما FTP (‏21) وTelnet (‏23) فيرسلان أسماء المستخدمين وكلمات المرور نصًا واضحًا.",
      "كثيرًا ما يشغّل الخادم الواحد عدة خدمات، وكل منها باب مستقل يحتاج إلى حماية خاصة.",
    ],
    defense: [
      "جرد الخدمات يوجّه التحديث والتحصين: كل خدمة تستمع تحتاج إلى مالك وإصدار معروف وسبب لوجودها.",
      "فضّل البروتوكولات المشفّرة (HTTPS وSSH وSFTP) وعطّل القديمة التي ترسل نصًا واضحًا.",
      "اقصر SSH على شبكات الإدارة، واطلب المفاتيح بدل كلمات المرور، وراقب دفعات محاولات الدخول الفاشلة التي تدل على هجمات التخمين.",
    ],
  },
  6: {
    packet: [
      "عندما تذهب حزمة إلى شبكة فرعية أخرى، تبقى عناوين IP من الطرف إلى الطرف (منك إلى خادم الويب)، لكن عنوان MAC الوجهة في Ethernet يكون للموجّه.",
      "في كل قفزة يكتب الموجّه ترويسة Ethernet جديدة ويخفض TTL بمقدار 1. لهذا تصل الردود من شبكة الخوادم بقيمة ttl=63 بدل 64.",
      "قارن بين أشعتين: ping داخل الشبكة المحلية وping عبر الموجّه لهما جزء ICMP نفسه لكن بعناوين MAC وقيم TTL مختلفة.",
    ],
    protocol: [
      "يقارن الجهاز الوجهة بقناع شبكته الفرعية (‎/24 يعني 255.255.255.0). الشبكة نفسها: يسأل ARP عن الجهاز مباشرة. شبكة مختلفة: يرسلها إلى البوابة الافتراضية.",
      "تمرّر الموجّهات الحزم بين الشبكات الفرعية باستخدام جداول التوجيه. لا تمرّر رسائل البث مثل ARP.",
      "لهذا تحتاج الأجهزة البعيدة إلى ping أو nmap: وحدها الأدوات العاملة في طبقة IP تستطيع عبور الموجّه.",
    ],
    defense: [
      "التقسيم يحدّ من نطاق الضرر: عندما تكون حواسيب الموظفين والخوادم في شبكات فرعية منفصلة، يقرر الموجّه أو الجدار الناري ما يُسمح له بالعبور.",
      "طبّق قوائم التحكم في الوصول بحيث لا يصل إلى شبكة الخوادم إلا المنافذ المطلوبة.",
      "راقب الأجهزة الداخلية التي تبدأ فجأة بفحص شبكات فرعية أخرى. التحرك الجانبي بعد الاختراق يشبه هذا المستوى تمامًا.",
    ],
  },
  7: {
    packet: [
      "الطرقة المُرشَّحة لا تعود منها أي حزمة رد. تُظهر الأشعة ما أُرسل فقط، وقسم \"ما الذي عاد\" فارغ.",
      "بعض الجدران النارية تعيد بدلًا من ذلك رسالة ICMP من النوع 3 \"ممنوع إداريًا\". ويعدّها nmap مُرشَّحة أيضًا.",
      "قارنها بالمنفذ المغلق: هناك تعود حزمة RST حقيقية من الخادم نفسه.",
    ],
    protocol: [
      "تستطيع الجدران النارية الإسقاط (التجاهل بصمت) أو الرفض (إعادة RST أو ICMP). الإسقاط يجبر الفاحص على انتظار انتهاء المهلة وإعادة المحاولة، فيصبح الفحص أبطأ وأقل يقينًا.",
      "يستخدم nmap ثلاث حالات: مفتوح (عاد SYN-ACK)، ومغلق (عاد RST)، ومُرشَّح (لم يعد شيء، أو عاد ICMP بعدم الوصول).",
      "مُرشَّح لا يعني فارغًا. قد تعمل خدمة خلف الجدار الناري، لكن لا يمكن الوصول إليها من موقعك.",
    ],
    defense: [
      "الرفض الافتراضي مع الإسقاط عند حدود الشبكة يعطي المهاجمين أقل قدر ممكن من المعلومات.",
      "سجلات الجدار الناري للحزم المُسقطة قيّمة: الإسقاط المتكرر من مصدر واحد عبر منافذ كثيرة يشير إلى فحص.",
      "اختبر قواعدك بنفسك بالفحص من الداخل والخارج، ووثّق الحالة المتوقعة لكل منفذ كي يظهر أي تغيير.",
    ],
  },
  8: {
    packet: [
      "هذا الجهاز يُسقط طلبات صدى ICMP، لكن مكدّس TCP فيه ما زال يجيب عن SYN على المنفذ 80 بـ SYN-ACK.",
      "في الشبكة المحلية يجب أن يجيب عن ARP كي يتواصل أصلًا، لذا لا يستطيع الاختباء في الطبقة الثانية.",
      "أشعتان تحكيان القصة: طلب ICMP بلا رد، ثم طرقة TCP بـ SYN-ACK كامل.",
    ],
    protocol: [
      "يكتشف nmap الأجهزة بعدة مجسّات: ARP في الشبكة المحلية؛ وخارجها صدى ICMP مع مجسّات TCP إلى منافذ مثل 80 و443.",
      "الخيار ‎-Pn يتخطى مرحلة الاكتشاف ويعامل الجهاز كأنه حي، فيطرق nmap المنافذ على أي حال.",
      "حظر ping وحده لا يجعل الجهاز غير مرئي. أي خدمة مفتوحة طريق للعثور عليه.",
    ],
    defense: [
      "\"الأمن بالتعتيم\"، مثل الاكتفاء بحظر ping، ضعيف. افترض أن كل خدمة يمكن الوصول إليها سيُعثر عليها.",
      "قلّل بدلًا من ذلك الخدمات المكشوفة، وراقب الخدمات التي يجب أن تبقى مفتوحة.",
      "التحكم في الوصول إلى الشبكة (802.1X) ومراقبة منافذ المبدّلات يكشفان الأجهزة المجهولة التي تجيب عن ARP حتى لو تجاهلت ping.",
    ],
  },
  9: {
    packet: [
      "يجيب DNS عادةً عن الاستعلامات عبر UDP على المنفذ 53، ويستخدم TCP 53 للإجابات الكبيرة ونقل المناطق. في هذا المختبر تطرق TCP 53.",
      "يستخدم FTP المنفذ TCP 21 للأوامر ويفتح اتصالًا منفصلًا لبيانات الملفات.",
      "طلبات HTTP أسطر نصية مقروءة مثل \"GET / HTTP/1.1\" تليها الترويسات، ولهذا تسهل قراءة حركة HTTP غير المشفّرة على السلك.",
    ],
    protocol: [
      "يحوّل DNS الأسماء إلى عناوين IP. يبدأ كل اتصال تقريبًا باستعلام DNS، فتصبح سجلات DNS خطًا زمنيًا لما حاول كل جهاز الوصول إليه.",
      "يرسل FTP أسماء المستخدمين وكلمات المرور دون تشفير.",
      "تحديد دور كل خادم يبني خريطة لما تعتمد عليه المؤسسة: الويب، وتحليل الأسماء، وتخزين الملفات.",
    ],
    defense: [
      "يجب أن ترفض خوادم DNS نقل المناطق (AXFR) إلى أي جهاز عشوائي. النقل يسرّب القائمة الكاملة للأسماء الداخلية.",
      "راقب DNS بحثًا عن نطاقات غير مألوفة أو أسماء طويلة جدًا تبدو عشوائية، فقد تعني نفقًا أو برمجية خبيثة تتصل بمشغّلها.",
      "استبدل FTP بـ SFTP أو FTPS، وضع الخوادم المواجهة للإنترنت في منطقة DMZ منفصلة عن البيانات الداخلية.",
    ],
  },
  10: {
    packet: [
      "عبر ثلاث شبكات فرعية رأيت الآن كل الطبقات: Ethernet لقفزة واحدة، وترويسات IP تنجو من التوجيه مع انخفاض TTL عند كل موجّه، وARP المحصور في المقطع المحلي، وICMP لاختبار الوصول، وأعلام TCP التي تكشف حالة المنافذ.",
      "العنوان الخاطئ ينتج حزمًا أيضًا: رسالة ICMP \"الوجهة غير قابلة للوصول\" من الموجّه تخبرك أن الشبكة موجودة لكن الجهاز غير موجود.",
      "قراءة الترويسات هي الطريقة التي يعيد بها المحللون بناء ما حدث من التقاط الحزم.",
    ],
    protocol: [
      "الاستطلاع الكامل يتبع منهجية: اكتشف الأجهزة المحلية (arp-scan)، ثم صل إلى الشبكات الفرعية البعيدة (ping أو nmap -sn)، ثم عدّد المنافذ والخدمات (nmap -p)، ثم سجّل كل شيء في السجل.",
      "يحفظ LDAP (‏389) دليل المستخدمين والمجموعات. ويتولى Kerberos (‏88) تسجيل الدخول في نطاقات ويندوز.",
      "خوادم النسخ الاحتياطي تحمل غالبًا نسخة من كل شيء، مما يجعلها حساسة بقدر البيانات التي تحميها.",
    ],
    defense: [
      "يطبّق المدافعون المنهجية نفسها على شبكاتهم، بإذن رسمي، ويقارنون النتائج بجرد الأصول الرسمي.",
      "خوادم الدليل والنسخ الاحتياطي جواهر التاج: اقصر الوصول على الأجهزة التي تحتاجها، وراقب كل تسجيل دخول، واحفظ النسخ الاحتياطية دون اتصال أو غير قابلة للتعديل كي لا تصل إليها برمجيات الفدية.",
      "لا تفحص إلا الشبكات التي تملكها أو لديك إذن مكتوب باختبارها. المهارات واحدة؛ والإذن هو ما يجعلها دفاعًا.",
    ],
  },
};

const LESSONS: Record<Language, Record<LevelId, Lesson>> = { en: EN, ar: AR };

export function getLesson(levelId: LevelId, language: Language): Lesson | undefined {
  return LESSONS[language][levelId] ?? EN[levelId];
}
