import { describe, expect, it } from "vitest";
import type { NetworkDevice, Topology } from "@/types/topology";
import { findDeviceByIp, routeHops } from "./routing";

const device = (id: string, kind: NetworkDevice["kind"], ip: string, extra: Partial<NetworkDevice> = {}) =>
  ({ id, name: id, kind, ip, mac: "", subnet: "", x: 0, y: 0, ports: [], ...extra }) satisfies NetworkDevice;

const topology: Topology = {
  subnets: [],
  devices: [
    device("you", "pc", "10.0.0.10", { isPlayer: true }),
    device("router", "router", "10.0.0.1", { ips: ["10.0.1.1"] }),
    device("web", "server", "10.0.1.10"),
    device("cam", "iot", "10.0.0.50"),
    device("island", "pc", "10.0.0.99"),
  ],
  links: [
    { from: "you", to: "router" },
    { from: "router", to: "web" },
    { from: "cam", to: "router" },
  ],
};

describe("routeHops", () => {
  it("routes across the router to another subnet", () => {
    expect(routeHops(topology, "you", "web")).toEqual(["you", "router", "web"]);
  });

  it("goes straight to a directly linked device", () => {
    expect(routeHops(topology, "you", "router")).toEqual(["you", "router"]);
  });

  it("walks to the nearest router when no device owns the target", () => {
    expect(routeHops(topology, "you", null)).toEqual(["you", "router"]);
  });

  it("falls back to a direct line when the map has no path", () => {
    expect(routeHops(topology, "you", "island")).toEqual(["you", "island"]);
  });

  it("returns only the source for a self-target", () => {
    expect(routeHops(topology, "you", "you")).toEqual(["you"]);
  });
});

describe("findDeviceByIp", () => {
  it("matches secondary interfaces", () => {
    expect(findDeviceByIp(topology, "10.0.1.1")?.id).toBe("router");
    expect(findDeviceByIp(topology, "10.9.9.9")).toBeUndefined();
  });
});
