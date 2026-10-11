import type { PacketOutcome, PacketProtocol } from "./topology";

/** What a caller (walkthrough, terminal, dev tools) asks the stage to animate. */
export interface PacketRequest {
  /** Device id that sends the packet. */
  srcId: string;
  /** Device id that owns the target address, or null when nobody does (wrong target). */
  dstId: string | null;
  /** Address shown on the packet. Defaults to the destination device's IP. */
  dstIp?: string;
  protocol: PacketProtocol;
  dstPort?: number;
  /** TCP source port. One scan reuses the same one, like nmap does. */
  srcPort?: number;
  /** ICMP sequence number (1, 2, 3... for `ping -c 3`). */
  seq?: number;
  outcome: PacketOutcome;
  /** Delay before launch, so a scan can fan out instead of firing all at once. */
  delayMs?: number;
  /** The command line that sent it. Absent for walkthrough packets. */
  command?: string;
}

export interface PacketFlow extends PacketRequest {
  id: string;
  emittedAt: number;
}
