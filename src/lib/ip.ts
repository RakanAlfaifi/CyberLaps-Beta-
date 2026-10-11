/** Sorts IPv4 addresses by numeric value, so 10.0.0.9 comes before 10.0.0.10. */
export function compareIp(a: string, b: string): number {
  const pa = a.split(".");
  const pb = b.split(".");
  for (let i = 0; i < 4; i++) {
    const diff = (Number(pa[i]) || 0) - (Number(pb[i]) || 0);
    if (diff !== 0) return diff;
  }
  return a.localeCompare(b);
}

export interface Cidr {
  network: string;
  prefix: number;
}

/** Unsigned 32-bit value of a dotted IPv4 address. Assumes the address is already valid. */
export function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => acc * 256 + Number(part), 0);
}

export function intToIp(value: number): string {
  return [24, 16, 8, 0].map((shift) => Math.floor(value / 2 ** shift) % 256).join(".");
}

function maskOf(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

/** Builds a CIDR from any address inside it, e.g. 10.0.0.7/24 -> 10.0.0.0/24. */
export function toCidr(ip: string, prefix: number): Cidr {
  return { network: intToIp((ipToInt(ip) & maskOf(prefix)) >>> 0), prefix };
}

/** "10.0.0.0/24" -> Cidr. Returns null for anything malformed. */
export function parseCidr(text: string): Cidr | null {
  const [ip, bits, extra] = text.split("/");
  const prefix = Number(bits);
  if (extra !== undefined || !isIpv4(ip) || !/^\d{1,2}$/.test(bits ?? "") || prefix > 32) return null;
  return toCidr(ip, prefix);
}

export function formatCidr(cidr: Cidr): string {
  return `${cidr.network}/${cidr.prefix}`;
}

export function cidrContains(cidr: Cidr, ip: string): boolean {
  const mask = maskOf(cidr.prefix);
  return ((ipToInt(ip) & mask) >>> 0) === ipToInt(cidr.network);
}

/** Usable host addresses, the way scanners count them (/31 and /32 have no network/broadcast). */
export function cidrHostCount(cidr: Cidr): number {
  const size = 2 ** (32 - cidr.prefix);
  return cidr.prefix >= 31 ? size : size - 2;
}

export function broadcastOf(cidr: Cidr): string {
  return intToIp(ipToInt(cidr.network) + 2 ** (32 - cidr.prefix) - 1);
}

export function isIpv4(text: string): boolean {
  const parts = text.split(".");
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}
