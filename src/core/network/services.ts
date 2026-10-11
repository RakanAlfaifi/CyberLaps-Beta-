/** Well-known TCP ports, as nmap names them. Used for `-p http` and for the SERVICE column. */
const SERVICES: ReadonlyArray<readonly [port: number, name: string, about: string, aboutAr: string]> = [
  [21, "ftp", "file transfer", "نقل الملفات"],
  [22, "ssh", "remote login", "الدخول عن بُعد"],
  [23, "telnet", "old, unsafe remote login", "دخول قديم وغير آمن عن بُعد"],
  [25, "smtp", "sending email", "إرسال البريد الإلكتروني"],
  [53, "domain", "DNS, turns names into IPs", "DNS، يحوّل الأسماء إلى عناوين IP"],
  [80, "http", "web pages", "صفحات الويب"],
  [88, "kerberos", "logins on big office networks", "تسجيل الدخول في شبكات المؤسسات الكبيرة"],
  [110, "pop3", "reading email", "قراءة البريد الإلكتروني"],
  [139, "netbios-ssn", "Windows file sharing (old)", "مشاركة ملفات ويندوز (قديمة)"],
  [143, "imap", "reading email", "قراءة البريد الإلكتروني"],
  [389, "ldap", "the staff directory", "دليل الموظفين"],
  [443, "https", "web pages, encrypted", "صفحات ويب مشفّرة"],
  [445, "microsoft-ds", "Windows file sharing", "مشاركة ملفات ويندوز"],
  [3389, "ms-wbt-server", "remote desktop", "سطح المكتب البعيد"],
  [8080, "http-proxy", "web pages (other port)", "صفحات الويب (منفذ بديل)"],
  [9100, "jetdirect", "printing", "الطباعة"],
];

const BY_PORT = new Map(SERVICES.map(([port, name, about, aboutAr]) => [port, { name, about, aboutAr }]));

const ALIASES: Record<string, number> = {
  dns: 53,
  rdp: 3389,
  smb: 445,
  print: 9100,
  printer: 9100,
};

const BY_NAME = new Map<string, number>([
  ...SERVICES.map(([port, name]) => [name, port] as const),
  ...Object.entries(ALIASES),
]);

export function serviceName(port: number): string | undefined {
  return BY_PORT.get(port)?.name;
}

/** One short phrase about what the port is for. */
export function serviceAbout(port: number, language: "en" | "ar" = "en"): string | undefined {
  const entry = BY_PORT.get(port);
  return language === "ar" ? entry?.aboutAr : entry?.about;
}

export function portForService(name: string): number | undefined {
  return BY_NAME.get(name.toLowerCase());
}

/** nmap's default list is ~1000 ports; the lab uses the ones its maps actually hide things behind. */
export const DEFAULT_SCAN_PORTS: readonly number[] = [21, 22, 23, 25, 53, 80, 88, 389, 443, 445, 3389, 9100];

/** `-F` (fast) scans fewer ports, just like the real flag. */
export const FAST_SCAN_PORTS: readonly number[] = [21, 22, 53, 80, 443, 3389];
