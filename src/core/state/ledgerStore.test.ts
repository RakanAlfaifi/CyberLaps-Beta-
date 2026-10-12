import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLedgerStore } from "./ledgerStore";
import { useProgressStore } from "./progressStore";

const ledger = () => useLedgerStore.getState();
const asset = (ip: string) => ledger().assets[ip];

describe("ledger store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    ledger().clearLedger();
    useProgressStore.getState().resetProgress();
  });

  afterEach(() => vi.useRealTimers());

  it("records a new asset against the current level", () => {
    useProgressStore.getState().startLevel(3);
    ledger().upsertAsset({ ip: "10.0.0.5", hostname: "alice" });

    expect(asset("10.0.0.5")).toEqual({
      ip: "10.0.0.5",
      hostname: "alice",
      discoveredInLevel: 3,
      ports: [],
      firstSeen: 1_000,
      lastSeen: 1_000,
    });
  });

  it("merges later finds without erasing known fields or the original level", () => {
    ledger().upsertAsset({ ip: "10.0.0.5", hostname: "alice", mac: "aa:bb" });
    useProgressStore.getState().startLevel(4);
    vi.setSystemTime(2_000);
    ledger().upsertAsset({ ip: "10.0.0.5", hostname: undefined, vendor: "Acme", discoveredInLevel: 9 });

    expect(asset("10.0.0.5")).toMatchObject({
      hostname: "alice",
      mac: "aa:bb",
      vendor: "Acme",
      discoveredInLevel: 1,
      firstSeen: 1_000,
      lastSeen: 2_000,
    });
  });

  it("merges ports by protocol and number and keeps them sorted", () => {
    ledger().addPorts("10.0.0.5", [
      { port: 80, protocol: "tcp", state: "open", service: "http" },
      { port: 22, protocol: "tcp", state: "filtered" },
    ]);
    ledger().addPorts("10.0.0.5", [
      { port: 80, protocol: "tcp", state: "closed", service: undefined },
      { port: 22, protocol: "udp", state: "open" },
    ]);

    expect(asset("10.0.0.5")?.ports).toEqual([
      { port: 22, protocol: "tcp", state: "filtered" },
      { port: 22, protocol: "udp", state: "open" },
      { port: 80, protocol: "tcp", state: "closed", service: "http" },
    ]);
  });

  it("removes a single asset and tolerates unknown IPs", () => {
    ledger().upsertAsset({ ip: "10.0.0.5" });
    ledger().upsertAsset({ ip: "10.0.0.6" });

    ledger().removeAsset("10.0.0.5");
    ledger().removeAsset("10.0.0.99");

    expect(Object.keys(ledger().assets)).toEqual(["10.0.0.6"]);
  });

  it("removes only the assets first found in a level", () => {
    ledger().upsertAsset({ ip: "10.0.0.5" });
    useProgressStore.getState().startLevel(2);
    ledger().upsertAsset({ ip: "10.0.0.6" });

    ledger().removeAssetsFoundIn(2);
    expect(Object.keys(ledger().assets)).toEqual(["10.0.0.5"]);
  });

  it("leaves state untouched when a level found nothing", () => {
    ledger().upsertAsset({ ip: "10.0.0.5" });
    const before = ledger().assets;
    ledger().removeAssetsFoundIn(7);
    expect(ledger().assets).toBe(before);
  });

  it("clears everything", () => {
    ledger().upsertAsset({ ip: "10.0.0.5" });
    ledger().clearLedger();
    expect(ledger().assets).toEqual({});
  });
});
