import type { LevelId } from "./level";
import type { DeviceKind } from "./topology";

export type PortProtocol = "tcp" | "udp";
export type PortState = "open" | "closed" | "filtered";

export interface LedgerPort {
  port: number;
  protocol: PortProtocol;
  state: PortState;
  service?: string;
}

export interface LedgerAsset {
  ip: string;
  mac?: string;
  hostname?: string;
  /** Device type, learned from a valid reply. */
  kind?: DeviceKind;
  vendor?: string;
  subnet?: string;
  ports: LedgerPort[];
  discoveredInLevel: LevelId;
  firstSeen: number;
  lastSeen: number;
}

/** What a scan reports. Only `ip` is required; known fields are merged in. */
export type LedgerAssetInput = Pick<LedgerAsset, "ip"> &
  Partial<Omit<LedgerAsset, "ip" | "ports" | "firstSeen" | "lastSeen">> & {
    ports?: LedgerPort[];
  };
