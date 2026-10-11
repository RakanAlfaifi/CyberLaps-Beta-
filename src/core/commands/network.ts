import { findDeviceByIp, routeHops } from "@/core/network/routing";
import { broadcastOf, cidrContains, parseCidr, toCidr, type Cidr } from "@/lib/ip";
import { editDistance } from "@/lib/text";
import type { NetworkDevice } from "@/types/topology";
import type { CommandContext } from "./types";

export { findDeviceByIp };

/** The LAN the player is plugged into. ARP only works inside it. */
export function playerLan(ctx: CommandContext): Cidr {
  return parseCidr(ctx.player.subnet) ?? toCidr(ctx.player.ip, 24);
}

export function addressesOf(device: NetworkDevice): string[] {
  return [device.ip, ...(device.ips ?? [])];
}

/** The device's address inside `range`, if it has one. */
export function addressIn(device: NetworkDevice, range: Cidr): string | undefined {
  return addressesOf(device).find((ip) => cidrContains(range, ip));
}

export function isOnLan(ctx: CommandContext, ip: string): boolean {
  return cidrContains(playerLan(ctx), ip);
}

/** Routers a packet crosses on the way, which is what lowers the TTL. */
export function routersCrossed(ctx: CommandContext, dstId: string | null): number {
  return Math.max(0, routeHops(ctx.level.topology, ctx.player.id, dstId).length - 2);
}

export function replyTtl(ctx: CommandContext, dstId: string): number {
  return 64 - routersCrossed(ctx, dstId);
}

/** Device that gives up on an unroutable packet: the last hop it reaches. */
export function dropPoint(ctx: CommandContext): NetworkDevice {
  const hops = routeHops(ctx.level.topology, ctx.player.id, null);
  const lastId = hops[hops.length - 1];
  return ctx.level.topology.devices.find((d) => d.id === lastId) ?? ctx.player;
}

/** Round trip in ms. Deterministic so the same command always reads the same. */
export function roundTripMs(ctx: CommandContext, dstId: string, salt: number): string {
  const hops = Math.max(1, routeHops(ctx.level.topology, ctx.player.id, dstId).length - 1);
  return (0.4 + hops * 0.55 + ((salt * 37) % 10) / 40).toFixed(2);
}

/** Explains why an address cannot belong to a device, or suggests the IP that was probably meant. */
export function wrongAddressTip(ctx: CommandContext, ip: string): string {
  const devices = ctx.level.topology.devices;
  for (const subnet of new Set(devices.map((d) => d.subnet))) {
    const cidr = parseCidr(subnet);
    if (!cidr) continue;
    if (ip === cidr.network) return `${ip} is the name of the whole network ${subnet}, not one device.`;
    if (ip === broadcastOf(cidr)) return `${ip} is the "everyone" (broadcast) address of ${subnet}, not one device.`;
  }

  const near = devices
    .filter((d) => !d.isPlayer)
    .flatMap(addressesOf)
    .find((known) => editDistance(known, ip) === 1);
  const base = `No device owns ${ip}, so the router had nowhere to send it.`;
  return near ? `${base} Did you mean ${near}?` : `${base} Check the IP for typos.`;
}

let ephemeral = 0;
/** Source ports for outgoing TCP, from the range real systems use. */
export function nextSourcePort(): number {
  ephemeral = (ephemeral + 7919) % 16000;
  return 49152 + ephemeral;
}
