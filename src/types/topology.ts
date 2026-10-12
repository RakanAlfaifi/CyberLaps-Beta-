import type { LevelId } from "./level";

export type DeviceKind = "router" | "pc" | "server" | "iot" | "switch" | "firewall";
export type PortState = "open" | "closed" | "filtered";

export interface DevicePort {
  number: number;
  state: PortState;
  service?: string;
}

export interface NetworkDevice {
  id: string;
  name: string;
  kind: DeviceKind;
  ip: string;
  /** Extra interfaces, e.g. a router's address on each subnet it joins. */
  ips?: string[];
  mac: string;
  subnet: string;
  /** Position in stage world units (the stage is laid out on a ~960x520 board). */
  x: number;
  y: number;
  isPlayer?: boolean;
  /** False means the device ignores ping (shows up as a timeout). */
  pingable?: boolean;
  ports: DevicePort[];
}

export interface NetworkLink {
  from: string;
  to: string;
}

export interface SubnetZone {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Topology {
  subnets: SubnetZone[];
  devices: NetworkDevice[];
  links: NetworkLink[];
}

export type PacketProtocol = "icmp" | "arp" | "tcp";

/**
 * How a packet ends. Drives the color it turns when it arrives:
 *  - success     : green, the target answered
 *  - rst         : red, the target refused (closed port)
 *  - timeout     : amber, the target stayed silent (filtered / ignores ping)
 *  - unreachable : amber, no device owns that address (wrong target)
 */
export type PacketOutcome = "success" | "rst" | "timeout" | "unreachable";

export interface WalkthroughBeat {
  /** Wait this long after the previous beat before showing this one. */
  delayMs: number;
  text: string;
  highlightDeviceId?: string;
  packet?: {
    src: string;
    dst: string;
    proto: PacketProtocol;
    dstPort?: number;
    outcome: PacketOutcome;
  };
}

/** Every listed requirement must be proven by commands run in the level itself. */
export interface LevelObjective {
  id: string;
  text: string;
  /** Devices a scan or ping must record. */
  requiredDeviceIds?: string[];
  /** Ports nmap must report on (whatever their real state is). */
  requiredPorts?: { deviceId: string; port: number }[];
  /** Commands that must run. With a target, that device must also answer the command. */
  requiredCommands?: { command: string; targetDeviceId?: string }[];
}

export interface LevelDefinition {
  id: LevelId;
  slug: string;
  title: string;
  summary: string;
  newTool?: string;
  /** Tools this level teaches. Every command still runs in every level. */
  featuredCommands: string[];
  topology: Topology;
  walkthrough: WalkthroughBeat[];
  objectives: LevelObjective[];
}
