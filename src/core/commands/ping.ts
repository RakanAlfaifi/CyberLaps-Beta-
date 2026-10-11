import { countValue, PING_DEFAULT_COUNT, type CommandAst } from "@/core/parser";
import type { PacketOutcome } from "@/types/topology";
import { dropPoint, findDeviceByIp, replyTtl, roundTripMs, wrongAddressTip } from "./network";
import { blank, line, print, probes, type CommandContext, type CommandRun, type Probe } from "./types";

/** Gap between echoes. Real ping waits a full second; that is too slow to watch. */
const PING_INTERVAL_MS = 650;

export function runPing(ast: CommandAst, ctx: CommandContext): CommandRun {
  const target = ast.args[0];
  if (target?.kind !== "ip") return { steps: [] };

  const ip = target.ip;
  const count = countValue(ast, "count") ?? PING_DEFAULT_COUNT;
  const device = findDeviceByIp(ctx.level.topology, ip);
  const outcome: PacketOutcome = !device ? "unreachable" : device.pingable === false ? "timeout" : "success";
  const gateway = dropPoint(ctx);

  const echoes: Probe[] = Array.from({ length: count }, (_, i) => {
    const seq = i + 1;
    const packet = {
      srcId: ctx.player.id,
      dstId: device?.id ?? null,
      dstIp: ip,
      protocol: "icmp" as const,
      seq,
      outcome,
      delayMs: i * PING_INTERVAL_MS,
      command: ctx.source,
    };

    // Ping only proves "something answered". It never names the device: that is arp-scan's and nmap's job.
    if (outcome === "success" && device) {
      return {
        packet,
        output: [
          line(`64 bytes from ${ip}: icmp_seq=${seq} ttl=${replyTtl(ctx, device.id)} time=${roundTripMs(ctx, device.id, seq)} ms`, "success"),
        ],
      };
    }
    if (outcome === "timeout") {
      return { packet, output: [line(`Request timeout for icmp_seq ${seq}`, "warning")] };
    }
    return { packet, output: [line(`From ${gateway.ip} icmp_seq=${seq} Destination Host Unreachable`, "error")] };
  });

  const received = outcome === "success" ? count : 0;
  const loss = Math.round(((count - received) / count) * 100);

  return {
    steps: [
      print(line(`PING ${ip} (${ip}) 56(84) bytes of data.`, "heading")),
      probes(echoes),
      print(
        blank,
        line(`--- ${ip} ping statistics ---`, "muted"),
        line(
          `${count} packets transmitted, ${received} received, ${loss}% packet loss`,
          received === count ? "plain" : "warning",
        ),
        line(tipFor(ctx, ip, outcome, device?.isPlayer === true), "tip"),
      ),
    ],
  };
}

function tipFor(ctx: CommandContext, ip: string, outcome: PacketOutcome, self: boolean): string {
  if (self) return "That is your own PC. It always answers itself.";
  if (outcome === "success") return `Green packets came back. ${ip} is online. To reveal who it is, run nmap -sn ${ip}.`;
  if (outcome === "timeout") {
    return `Something is at ${ip}, but it ignores ping. Amber means no answer. A device can be quiet and still alive.`;
  }
  return wrongAddressTip(ctx, ip);
}
