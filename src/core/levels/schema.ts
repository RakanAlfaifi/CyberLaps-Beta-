import { z } from "zod";

const portSchema = z.object({
  number: z.number().int().min(1).max(65535),
  state: z.enum(["open", "closed", "filtered"]),
  service: z.string().optional(),
});

const deviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["router", "pc", "server", "iot", "switch", "firewall"]),
  ip: z.string().min(7),
  ips: z.array(z.string()).optional(),
  mac: z.string(),
  subnet: z.string(),
  x: z.number(),
  y: z.number(),
  isPlayer: z.boolean().optional(),
  pingable: z.boolean().optional(),
  ports: z.array(portSchema),
});

const protocolSchema = z.enum(["icmp", "arp", "tcp"]);
const outcomeSchema = z.enum(["success", "rst", "timeout", "unreachable"]);

const beatSchema = z.object({
  delayMs: z.number().min(0),
  text: z.string().min(1),
  highlightDeviceId: z.string().optional(),
  packet: z
    .object({
      src: z.string(),
      dst: z.string(),
      proto: protocolSchema,
      dstPort: z.number().int().optional(),
      outcome: outcomeSchema,
    })
    .optional(),
});

/** Shape of `src/content/levels/level-XX.json`. */
export const levelFileSchema = z
  .object({
    id: z.string(),
    number: z.number().int().min(1),
    title: z.string(),
    summary: z.string(),
    newTool: z.string().optional(),
    featuredCommands: z.array(z.string()),
    topology: z.object({
      subnets: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          x: z.number(),
          y: z.number(),
          w: z.number().positive(),
          h: z.number().positive(),
        }),
      ),
      devices: z.array(deviceSchema).min(1),
      links: z.array(z.object({ from: z.string(), to: z.string() })),
    }),
    cinematic: z.array(beatSchema),
    objectives: z.array(
      z
        .object({
          id: z.string(),
          text: z.string(),
          requiredDeviceIds: z.array(z.string()).optional(),
          requiredPorts: z.array(z.object({ deviceId: z.string(), port: z.number().int() })).optional(),
          requiredCommands: z
            .array(z.object({ command: z.string(), targetDeviceId: z.string().optional() }))
            .optional(),
        })
        .refine(
          (o) => (o.requiredDeviceIds?.length ?? 0) + (o.requiredPorts?.length ?? 0) + (o.requiredCommands?.length ?? 0) > 0,
          { message: "objective has nothing to check" },
        ),
    ),
  })
  .superRefine((level, ctx) => {
    const ids = new Set(level.topology.devices.map((d) => d.id));
    const players = level.topology.devices.filter((d) => d.isPlayer).length;
    if (players !== 1) {
      ctx.addIssue({ code: "custom", message: `expected exactly 1 player device, found ${players}` });
    }
    const missing = (id: string | undefined, where: string) => {
      if (id !== undefined && !ids.has(id)) {
        ctx.addIssue({ code: "custom", message: `${where} points at unknown device "${id}"` });
      }
    };
    level.topology.links.forEach((l, i) => {
      missing(l.from, `links[${i}].from`);
      missing(l.to, `links[${i}].to`);
    });
    level.cinematic.forEach((b, i) => {
      missing(b.highlightDeviceId, `cinematic[${i}].highlightDeviceId`);
      missing(b.packet?.src, `cinematic[${i}].packet.src`);
      missing(b.packet?.dst, `cinematic[${i}].packet.dst`);
    });
    if (level.objectives.length === 0) {
      ctx.addIssue({ code: "custom", message: "a playable level needs at least one objective" });
    }
    level.objectives.forEach((o, i) => {
      o.requiredDeviceIds?.forEach((id, j) => missing(id, `objectives[${i}].requiredDeviceIds[${j}]`));
      o.requiredPorts?.forEach((p, j) => {
        missing(p.deviceId, `objectives[${i}].requiredPorts[${j}]`);
        const device = level.topology.devices.find((d) => d.id === p.deviceId);
        if (device && !device.ports.some((dp) => dp.number === p.port)) {
          ctx.addIssue({ code: "custom", message: `objectives[${i}] wants port ${p.port}, which ${p.deviceId} does not have` });
        }
      });
      o.requiredCommands?.forEach((c, j) => {
        missing(c.targetDeviceId, `objectives[${i}].requiredCommands[${j}].targetDeviceId`);
        if (!level.featuredCommands.includes(c.command)) {
          ctx.addIssue({ code: "custom", message: `objectives[${i}] needs "${c.command}", which this level does not feature` });
        }
      });
    });
  });

export type LevelFile = z.infer<typeof levelFileSchema>;

/** Shape of `src/content/levels/coming-soon.json`: only what the level map shows. */
export const comingSoonFileSchema = z.object({
  levels: z.array(
    z.object({
      number: z.number().int().min(1),
      title: z.string().min(1),
      summary: z.string().min(1),
    }),
  ),
});
