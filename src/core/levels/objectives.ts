import type { Probe } from "@/core/commands/types";
import type { LedgerAssetInput } from "@/types/ledger";
import type { DevicePort, LevelDefinition, LevelObjective, PacketOutcome } from "@/types/topology";

/**
 * What the player has proven inside one level. It is written at the same moment
 * as the ledger, but kept per level: the ledger is shared across levels, so
 * finds from an earlier level must not finish a later one by themselves.
 */
export interface LevelEvidence {
  /** Device ids a command recorded. */
  devices: string[];
  /** `deviceId:port` pairs nmap reported on. */
  ports: string[];
  /** Commands that ran (parsed, not --help). */
  commands: string[];
  /** `command>deviceId`: that device answered that command. */
  replies: string[];
  /** Device ids whose MAC address came back in a reply (only possible on the local LAN). */
  macs: string[];
}

export const EMPTY_EVIDENCE: LevelEvidence = { devices: [], ports: [], commands: [], replies: [], macs: [] };

const portKey = (deviceId: string, port: number) => `${deviceId}:${port}`;
const replyKey = (command: string, deviceId: string) => `${command}>${deviceId}`;

/** The only tools allowed to reveal a device on the stage or write it to the Recon Ledger. */
export const DISCOVERY_COMMANDS: readonly string[] = ["arp-scan", "nmap"];

/** Outcomes where a packet really came back from the target. */
const ANSWERED: readonly PacketOutcome[] = ["success", "rst"];

/** What a landed probe may write to the ledger: nothing unless it came from a discovery command. */
export function verifiedFinds(command: string, probe: Probe): LedgerAssetInput[] {
  if (!DISCOVERY_COMMANDS.includes(command) || !probe.packet.dstId) return [];
  return probe.discover ?? [];
}

export function evidenceOfProbe(command: string, probe: Probe): Partial<LevelEvidence> {
  const { dstId, outcome } = probe.packet;
  if (!dstId) return {};
  const found = verifiedFinds(command, probe);
  // A filtered knock still counts as a checked port, but only a real answer proves the device exists.
  const answered = found.length > 0 && ANSWERED.includes(outcome);
  return {
    devices: answered ? [dstId] : [],
    ports: found.flatMap((asset) => asset.ports ?? []).map((p) => portKey(dstId, p.port)),
    replies: outcome === "success" ? [replyKey(command, dstId)] : [],
    macs: answered && found.some((asset) => asset.mac) ? [dstId] : [],
  };
}

/** Returns `base` itself when nothing is new, so stores can skip the update. */
export function mergeEvidence(base: LevelEvidence, add: Partial<LevelEvidence>): LevelEvidence {
  let changed = false;
  const union = (have: string[] = [], incoming: string[] = []) => {
    const fresh = incoming.filter((v, i) => !have.includes(v) && incoming.indexOf(v) === i);
    if (fresh.length === 0) return have;
    changed = true;
    return [...have, ...fresh];
  };
  const next: LevelEvidence = {
    devices: union(base.devices, add.devices),
    ports: union(base.ports, add.ports),
    commands: union(base.commands, add.commands),
    replies: union(base.replies, add.replies),
    macs: union(base.macs, add.macs),
  };
  return changed ? next : base;
}

/** One checkable part of an objective. The UI turns it into words in the current language. */
export type Requirement =
  | { kind: "run"; command: string }
  | { kind: "find"; deviceId: string }
  | { kind: "port"; deviceId: string; port: number }
  | { kind: "reply"; command: string; deviceId: string };

export interface RequirementStatus {
  /** Stable id, unique within its objective. */
  key: string;
  requirement: Requirement;
  done: boolean;
}

export interface ObjectiveStatus {
  id: string;
  text: string;
  done: boolean;
  requirements: RequirementStatus[];
}

function requirementsOf(objective: LevelObjective, evidence: LevelEvidence): RequirementStatus[] {
  const commands = objective.requiredCommands ?? [];
  const has = (list: string[] | undefined, value: string) => (list ?? []).includes(value);

  return [
    ...commands
      .filter((c) => !c.targetDeviceId)
      .map((c) => ({
        key: `run:${c.command}`,
        requirement: { kind: "run", command: c.command } as const,
        done: has(evidence.commands, c.command),
      })),
    ...(objective.requiredDeviceIds ?? []).map((id) => ({
      key: `find:${id}`,
      requirement: { kind: "find", deviceId: id } as const,
      done: has(evidence.devices, id),
    })),
    ...(objective.requiredPorts ?? []).map((p) => ({
      key: `port:${p.deviceId}:${p.port}`,
      requirement: { kind: "port", deviceId: p.deviceId, port: p.port } as const,
      done: has(evidence.ports, portKey(p.deviceId, p.port)),
    })),
    ...commands
      .filter((c): c is { command: string; targetDeviceId: string } => c.targetDeviceId !== undefined)
      .map((c) => ({
        key: `reply:${c.command}:${c.targetDeviceId}`,
        requirement: { kind: "reply", command: c.command, deviceId: c.targetDeviceId } as const,
        done: has(evidence.replies, replyKey(c.command, c.targetDeviceId)),
      })),
  ];
}

export function evaluateObjectives(level: LevelDefinition, evidence: LevelEvidence = EMPTY_EVIDENCE): ObjectiveStatus[] {
  return level.objectives.map((objective) => {
    const requirements = requirementsOf(objective, evidence);
    // An objective with nothing to prove must never count as done by itself.
    const done = requirements.length > 0 && requirements.every((r) => r.done);
    return { id: objective.id, text: objective.text, requirements, done };
  });
}

/** True only when the level has objectives and every single one of them is fully proven. */
export function objectivesMet(level: LevelDefinition, evidence: LevelEvidence | undefined): boolean {
  const statuses = evaluateObjectives(level, evidence ?? EMPTY_EVIDENCE);
  return statuses.length > 0 && statuses.every((s) => s.done);
}

/** What the player has verified about one device in this level. */
export interface DeviceIntel {
  /** A discovery query got a valid reply from it (always true for the player's own PC). */
  verified: boolean;
  /** Its MAC address came back in a reply. */
  macKnown: boolean;
  /** Ports nmap reported on, with their real state. */
  ports: DevicePort[];
}

/** Per-device view of the evidence: drives the stage's "unverified node" placeholders. */
export function deviceIntel(level: LevelDefinition, evidence: LevelEvidence | undefined): Map<string, DeviceIntel> {
  const proof = evidence ?? EMPTY_EVIDENCE;
  const has = (list: string[] | undefined, value: string) => (list ?? []).includes(value);
  return new Map(
    level.topology.devices.map((device) => {
      const self = device.isPlayer === true;
      return [
        device.id,
        {
          verified: self || has(proof.devices, device.id),
          macKnown: self || has(proof.macs, device.id),
          ports: device.ports.filter((p) => has(proof.ports, portKey(device.id, p.number))),
        },
      ] as const;
    }),
  );
}
