import { hasFlag, portsValue, type ArgNode, type CommandAst } from "@/core/parser";
import { DEFAULT_SCAN_PORTS, FAST_SCAN_PORTS, serviceName } from "@/core/network/services";
import { cidrContains, compareIp, formatCidr, intToIp, ipToInt } from "@/lib/ip";
import type { LedgerAssetInput, PortState } from "@/types/ledger";
import type { NetworkDevice, PacketOutcome } from "@/types/topology";
import { addressesOf, findDeviceByIp, isOnLan, nextSourcePort, roundTripMs, wrongAddressTip } from "./network";
import {
  blank,
  line,
  print,
  probes,
  type CommandContext,
  type CommandRun,
  type OutputLine,
  type Probe,
  type Step,
  type Tone,
} from "./types";

const STAGGER_MS = 140;

const STATE_OUTCOME: Record<PortState, PacketOutcome> = { open: "success", closed: "rst", filtered: "timeout" };
const STATE_TONE: Record<PortState, Tone> = { open: "success", closed: "error", filtered: "warning" };

const banner = print(line("Starting Nmap 7.94 ( https://nmap.org )", "muted"));

export function runNmap(ast: CommandAst, ctx: CommandContext): CommandRun {
  const target = ast.args[0];
  if (!target || target.kind === "topic") return { steps: [] };
  if (hasFlag(ast, "pingScan")) return hostDiscovery(target, ctx);
  if (target.kind !== "ip") return { steps: [] };
  return portScan(ast, target.ip, ctx);
}

interface Discovery {
  probe: Probe;
  up: boolean;
  device?: NetworkDevice;
}

/**
 * How nmap decides a host is up before knocking: ARP on the local LAN, otherwise
 * a ping, then a knock on a web port for hosts that ignore ping.
 */
function discover(ctx: CommandContext, ip: string, delayMs = 0): Discovery {
  const device = findDeviceByIp(ctx.level.topology, ip);
  const packet = { srcId: ctx.player.id, dstId: device?.id ?? null, dstIp: ip, delayMs, command: ctx.source };
  const result = (up: boolean, extra: Omit<Probe["packet"], keyof typeof packet>): Discovery => ({
    probe: { packet: { ...packet, ...extra }, output: up && device ? reportLines(ctx, device, ip) : [] },
    up,
    device,
  });

  if (isOnLan(ctx, ip)) return result(!!device, { protocol: "arp", outcome: device ? "success" : "unreachable" });
  if (!device) return result(false, { protocol: "icmp", outcome: "unreachable" });
  if (device.pingable !== false) return result(true, { protocol: "icmp", outcome: "success", seq: 1 });

  const web = device.ports.find((p) => (p.number === 443 || p.number === 80) && p.state === "open");
  if (web) return result(true, { protocol: "tcp", dstPort: web.number, srcPort: nextSourcePort(), outcome: "success" });
  return result(false, { protocol: "icmp", outcome: "timeout", seq: 1 });
}

function reportLines(ctx: CommandContext, device: NetworkDevice, ip: string): OutputLine[] {
  const latency = (Number(roundTripMs(ctx, device.id, 1)) / 1000).toFixed(4);
  const lines = [line(`Nmap scan report for ${device.name} (${ip})`, "heading"), line(`Host is up (${latency}s latency).`, "success")];
  if (isOnLan(ctx, ip) && !device.isPlayer) lines.push(line(`MAC Address: ${device.mac}`, "info"));
  return lines;
}

function assetOf(ctx: CommandContext, device: NetworkDevice, ip: string): LedgerAssetInput {
  return {
    ip,
    hostname: device.name,
    kind: device.kind,
    subnet: device.subnet,
    ...(isOnLan(ctx, ip) ? { mac: device.mac } : {}),
  };
}

function hostDiscovery(target: Exclude<ArgNode, { kind: "topic" }>, ctx: CommandContext): CommandRun {
  const range = target.kind === "cidr" ? target.cidr : null;
  const label = target.kind === "cidr" ? formatCidr(target.cidr) : target.ip;
  const total = range ? 2 ** (32 - range.prefix) : 1;

  let addresses: string[];
  if (range) {
    addresses = ctx.level.topology.devices
      .filter((d) => !d.isPlayer)
      .flatMap((d) => addressesOf(d).filter((ip) => cidrContains(range, ip)))
      .sort(compareIp);
    // An empty range still sends something, so the stage shows the question going nowhere.
    if (addresses.length === 0) addresses = [intToIp(ipToInt(range.network) + 1)];
  } else {
    addresses = [label];
  }

  const results = addresses.map((ip, i) => {
    const found = discover(ctx, ip, i * STAGGER_MS);
    if (found.up && found.device && !found.device.isPlayer) found.probe.discover = [assetOf(ctx, found.device, ip)];
    return found;
  });
  const up = results.filter((r) => r.up).length;

  let tip: string;
  if (up > 0) tip = "Each green reply is a device that is awake. Next, knock on its doors: nmap -p 22,80 <ip>";
  else if (range) tip = `Nobody answered in ${label}.`;
  else if (results[0].device) tip = `Something at ${label} stayed quiet. Quiet is not the same as empty: try nmap -Pn -p 80 ${label}`;
  else tip = wrongAddressTip(ctx, label);

  const footer: OutputLine[] = [];
  if (!range && up === 0) {
    footer.push(line("Note: Host seems down. If it is really up, but blocking our ping probes, try -Pn", "warning"));
  }
  footer.push(
    blank,
    line(`Nmap done: ${total} IP address${total === 1 ? "" : "es"} (${up} host${up === 1 ? "" : "s"} up) scanned`),
    line(tip, "tip"),
  );

  return { steps: [banner, probes(results.map((r) => r.probe)), print(...footer)] };
}

function portScan(ast: CommandAst, ip: string, ctx: CommandContext): CommandRun {
  const ports = portsValue(ast, "ports") ?? (hasFlag(ast, "fast") ? FAST_SCAN_PORTS : DEFAULT_SCAN_PORTS);
  const steps: Step[] = [banner];
  let device = findDeviceByIp(ctx.level.topology, ip);

  if (!hasFlag(ast, "noPing")) {
    const check = discover(ctx, ip);
    check.probe.output = [];
    if (check.up && check.device && !check.device.isPlayer) check.probe.discover = [assetOf(ctx, check.device, ip)];
    steps.push(probes([check.probe]));
    if (!check.up) {
      const tip = check.device
        ? `Something at ${ip} stayed quiet, so nmap gave up before knocking. Add -Pn to knock anyway.`
        : wrongAddressTip(ctx, ip);
      steps.push(
        print(
          line("Note: Host seems down. If it is really up, but blocking our ping probes, try -Pn", "warning"),
          blank,
          line("Nmap done: 1 IP address (0 hosts up) scanned"),
          line(tip, "tip"),
        ),
      );
      return { steps };
    }
    device = check.device;
  }

  steps.push(
    print(
      ...(device ? reportLines(ctx, device, ip) : [line(`Nmap scan report for ${ip}`, "heading"), line("Host is up.")]),
      line("PORT      STATE     SERVICE", "muted"),
    ),
  );

  const srcPort = nextSourcePort();
  const counts: Record<PortState, number> = { open: 0, closed: 0, filtered: 0 };
  const stateOf = (port: number): PortState => (device ? (device.ports.find((p) => p.number === port)?.state ?? "closed") : "filtered");
  // With -Pn nobody checked the host first, so it is only proven if at least one knock got an answer.
  const hostAnswered = !hasFlag(ast, "noPing") || ports.some((port) => stateOf(port) !== "filtered");
  const knocks: Probe[] = ports.map((port, i) => {
    const known = device?.ports.find((p) => p.number === port);
    const state = stateOf(port);
    const service = known?.service ?? serviceName(port);
    counts[state]++;

    const probe: Probe = {
      packet: {
        srcId: ctx.player.id,
        dstId: device?.id ?? null,
        dstIp: ip,
        protocol: "tcp",
        srcPort,
        dstPort: port,
        outcome: device ? STATE_OUTCOME[state] : "unreachable",
        delayMs: i * STAGGER_MS,
        command: ctx.source,
      },
      output: [
        [
          { text: `${port}/tcp`.padEnd(10) },
          { text: state.padEnd(10), tone: STATE_TONE[state] },
          { text: service ?? "unknown", tone: "muted" },
        ],
      ],
    };
    if (device && !device.isPlayer && hostAnswered && (known || state === "open")) {
      probe.discover = [{ ...assetOf(ctx, device, ip), ports: [{ port, protocol: "tcp", state, service }] }];
    }
    return probe;
  });
  steps.push(probes(knocks));

  const tip = device
    ? `${counts.open} open, ${counts.closed} closed, ${counts.filtered} filtered. Green = open door, red = closed (RST), amber = no answer (filtered).`
    : `${wrongAddressTip(ctx, ip)} Every knock got lost, so nmap calls the ports filtered.`;
  steps.push(print(blank, line(`Nmap done: 1 IP address (1 host up) scanned`), line(tip, "tip")));

  return { steps };
}
