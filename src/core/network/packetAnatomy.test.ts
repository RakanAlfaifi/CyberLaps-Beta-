import { describe, expect, it } from "vitest";
import { getLevelDefinition } from "@/core/levels";
import { describePacket, type HeaderLayer } from "./packetAnatomy";

const topology = getLevelDefinition(6)!.topology;
const field = (layers: HeaderLayer[] | null, id: string, label: string) =>
  layers?.find((l) => l.id === id)?.fields.find((f) => f.label === label)?.value;

describe("describePacket", () => {
  it("shows an echo across the router with the TTL dropping on the reply", () => {
    const a = describePacket({ srcId: "you", dstId: "web", protocol: "icmp", seq: 2, outcome: "success" }, topology);
    expect(a.route.map((r) => r.id)).toEqual(["you", "router", "web"]);
    expect(field(a.request, "ethernet", "Destination MAC")).toBe("aa:aa:aa:00:00:01");
    expect(field(a.request, "icmp", "Type")).toBe("8 (echo request)");
    expect(field(a.request, "icmp", "Sequence")).toBe("2");
    expect(field(a.reply, "icmp", "Type")).toBe("0 (echo reply)");
    expect(field(a.reply, "ip", "TTL")).toBe("63");
  });

  it("broadcasts ARP and learns the MAC from the reply", () => {
    const a = describePacket({ srcId: "you", dstId: "alice", dstIp: "10.0.0.20", protocol: "arp", outcome: "success" }, topology);
    expect(field(a.request, "ethernet", "Destination MAC")).toBe("ff:ff:ff:ff:ff:ff");
    expect(field(a.reply, "arp", "Sender MAC")).toBe("aa:aa:aa:00:00:20");
  });

  it("answers a closed port with RST and swaps the ports", () => {
    const a = describePacket(
      { srcId: "you", dstId: "web", protocol: "tcp", srcPort: 50000, dstPort: 22, outcome: "rst" },
      topology,
    );
    expect(field(a.request, "tcp", "Flags")).toBe("SYN");
    expect(field(a.reply, "tcp", "Flags")).toBe("RST, ACK");
    expect(field(a.reply, "tcp", "Source port")).toBe("22 (ssh)");
    expect(field(a.reply, "tcp", "Destination port")).toBe("50000");
  });

  it("marks a wrong address as dropped at the router", () => {
    const a = describePacket({ srcId: "you", dstId: null, dstIp: "10.9.9.9", protocol: "icmp", outcome: "unreachable" }, topology);
    expect(a.dropped).toBe(true);
    expect(a.route.at(-1)?.id).toBe("router");
    expect(field(a.reply, "icmp", "Type")).toBe("3 (destination unreachable)");
  });

  it("has no reply for a filtered port", () => {
    expect(describePacket({ srcId: "you", dstId: "web", protocol: "tcp", dstPort: 3389, outcome: "timeout" }, topology).reply).toBeNull();
  });
});
