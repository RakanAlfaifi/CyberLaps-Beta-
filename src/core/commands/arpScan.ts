import { hasFlag, type CommandAst } from "@/core/parser";
import { cidrContains, cidrHostCount, compareIp, formatCidr, intToIp, ipToInt, type Cidr } from "@/lib/ip";
import { addressIn, playerLan } from "./network";
import { blank, line, print, probes, type CommandContext, type CommandRun, type Probe } from "./types";

const STAGGER_MS = 160;

export function runArpScan(ast: CommandAst, ctx: CommandContext): CommandRun {
  const lan = playerLan(ctx);
  const arg = ast.args[0];
  const single = arg?.kind === "ip" ? arg.ip : null;
  const range: Cidr =
    hasFlag(ast, "localnet") || !arg ? lan : arg.kind === "cidr" ? arg.cidr : { network: single!, prefix: 32 };
  const label = single ?? formatCidr(range);
  const hostCount = cidrHostCount(range);
  const nested = cidrContains(lan, range.network) || cidrContains(range, lan.network);

  const header = print(
    line(`Interface: eth0, MAC: ${ctx.player.mac}, IPv4: ${ctx.player.ip}`, "muted"),
    line(`Starting arp-scan with ${hostCount} host${hostCount === 1 ? "" : "s"} (${label})`, "heading"),
  );
  const footer = (responded: number, tip: string) =>
    print(blank, line(`Ending arp-scan: ${hostCount} hosts scanned. ${responded} responded`), line(tip, "tip"));

  // A question nobody on the LAN can answer: it walks to the router and stops there.
  const unanswered = (ip: string): Probe => ({
    packet: { srcId: ctx.player.id, dstId: null, dstIp: ip, protocol: "arp", outcome: "unreachable", command: ctx.source },
    output: [],
  });

  if (!nested) {
    const asked = single ?? intToIp(ipToInt(range.network) + 1);
    return {
      steps: [
        header,
        probes([unanswered(asked)]),
        footer(
          0,
          `${label} is not on your LAN (${formatCidr(lan)}). ARP only asks neighbors, so the router stops the question. Use ping or nmap for far networks.`,
        ),
      ],
    };
  }

  const scanned = range.prefix >= lan.prefix ? range : lan;
  const neighbors = ctx.level.topology.devices
    .filter((d) => !d.isPlayer)
    .map((d) => ({ device: d, ip: addressIn(d, scanned) }))
    .filter((n): n is { device: typeof n.device; ip: string } => n.ip !== undefined)
    .sort((a, b) => compareIp(a.ip, b.ip));

  if (neighbors.length === 0) {
    if (single && single !== ctx.player.ip) {
      return {
        steps: [header, probes([unanswered(single)]), footer(0, `No neighbor uses ${single}. Nobody answered "who has ${single}?".`)],
      };
    }
    return { steps: [header, footer(0, "Nobody else is on this part of the LAN.")] };
  }

  const replies: Probe[] = neighbors.map(({ device, ip }, i) => ({
    packet: {
      srcId: ctx.player.id,
      dstId: device.id,
      dstIp: ip,
      protocol: "arp",
      outcome: "success",
      delayMs: i * STAGGER_MS,
      command: ctx.source,
    },
    output: [
      [
        { text: ip.padEnd(16), tone: "success" },
        { text: device.mac.padEnd(19), tone: "info" },
        { text: device.name },
      ],
    ],
    discover: [{ ip, mac: device.mac, hostname: device.name, kind: device.kind, subnet: device.subnet }],
  }));

  const tip =
    range.prefix < lan.prefix
      ? `Only your LAN (${formatCidr(lan)}) can answer ARP. The rest of ${label} is behind the router.`
      : `Found ${neighbors.length} neighbor${neighbors.length === 1 ? "" : "s"}. They are saved in your Recon Ledger.`;

  return {
    steps: [header, print(line("IP              MAC                Name", "muted")), probes(replies), footer(neighbors.length, tip)],
  };
}
