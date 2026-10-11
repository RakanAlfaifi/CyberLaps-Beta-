import type { NetworkDevice, Topology } from "@/types/topology";

export function findDeviceByIp(topology: Topology, ip: string): NetworkDevice | undefined {
  return topology.devices.find((d) => d.ip === ip || d.ips?.includes(ip));
}

function adjacency(topology: Topology): Map<string, string[]> {
  const graph = new Map<string, string[]>(topology.devices.map((d) => [d.id, []]));
  for (const { from, to } of topology.links) {
    graph.get(from)?.push(to);
    graph.get(to)?.push(from);
  }
  return graph;
}

/** Shortest path over links from `srcId` to the first node accepted by `isGoal`. */
function bfs(topology: Topology, srcId: string, isGoal: (id: string) => boolean): string[] | null {
  const graph = adjacency(topology);
  if (!graph.has(srcId)) return null;

  const previous = new Map<string, string | null>([[srcId, null]]);
  const queue = [srcId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (isGoal(id)) {
      const path: string[] = [];
      for (let at: string | null = id; at !== null; at = previous.get(at) ?? null) path.unshift(at);
      return path;
    }
    for (const next of graph.get(id) ?? []) {
      if (!previous.has(next)) {
        previous.set(next, id);
        queue.push(next);
      }
    }
  }
  return null;
}

/**
 * Device ids a packet visits, source first.
 *  - Known target: the shortest path along links (a direct line if the map has no path).
 *  - Unknown target (`dstId` null): the packet walks to the nearest router and dies there,
 *    which is how a real LAN treats an address nobody owns.
 */
export function routeHops(topology: Topology, srcId: string, dstId: string | null): string[] {
  if (dstId === null) {
    const kinds = new Map(topology.devices.map((d) => [d.id, d.kind]));
    return bfs(topology, srcId, (id) => id !== srcId && kinds.get(id) === "router") ?? [srcId];
  }
  if (srcId === dstId) return [srcId];
  return bfs(topology, srcId, (id) => id === dstId) ?? [srcId, dstId];
}
