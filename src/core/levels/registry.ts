import level01 from "@/content/levels/level-01.json";
import level02 from "@/content/levels/level-02.json";
import level03 from "@/content/levels/level-03.json";
import level04 from "@/content/levels/level-04.json";
import level05 from "@/content/levels/level-05.json";
import level06 from "@/content/levels/level-06.json";
import level07 from "@/content/levels/level-07.json";
import level08 from "@/content/levels/level-08.json";
import level09 from "@/content/levels/level-09.json";
import level10 from "@/content/levels/level-10.json";
import comingSoon from "@/content/levels/coming-soon.json";
import type { LevelId } from "@/types/level";
import type { LevelDefinition, NetworkDevice } from "@/types/topology";
import { comingSoonFileSchema, levelFileSchema, type LevelFile } from "./schema";

const LEVEL_FILES: readonly unknown[] = [
  level01,
  level02,
  level03,
  level04,
  level05,
  level06,
  level07,
  level08,
  level09,
  level10,
];

function toDefinition(file: LevelFile): LevelDefinition {
  return {
    id: file.number,
    slug: file.id,
    title: file.title,
    summary: file.summary,
    newTool: file.newTool,
    featuredCommands: file.featuredCommands,
    topology: file.topology,
    walkthrough: file.cinematic,
    objectives: file.objectives,
  };
}

/** Validated once at startup so a broken level file fails loudly instead of rendering half a map. */
const LEVELS: ReadonlyMap<LevelId, LevelDefinition> = new Map(
  LEVEL_FILES.map((raw, index) => {
    const result = levelFileSchema.safeParse(raw);
    if (!result.success) {
      const detail = result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
      throw new Error(`Level file #${index + 1} is invalid: ${detail}`);
    }
    const level = toDefinition(result.data);
    return [level.id, level] as const;
  }),
);

export function getLevelDefinition(id: LevelId): LevelDefinition | undefined {
  return LEVELS.get(id);
}

export function listLevelDefinitions(): LevelDefinition[] {
  return [...LEVELS.values()].sort((a, b) => a.id - b.id);
}

/** A level that is announced but not built yet. */
export interface ComingSoonLevel {
  id: LevelId;
  title: string;
  summary: string;
}

const COMING_SOON: readonly ComingSoonLevel[] = comingSoonFileSchema
  .parse(comingSoon)
  .levels.map((l) => ({ id: l.number, title: l.title, summary: l.summary }))
  .filter((l) => !LEVELS.has(l.id))
  .sort((a, b) => a.id - b.id);

export function listComingSoonLevels(): readonly ComingSoonLevel[] {
  return COMING_SOON;
}

export function getPlayerDevice(level: LevelDefinition): NetworkDevice {
  const player = level.topology.devices.find((d) => d.isPlayer);
  if (!player) throw new Error(`Level ${level.id} has no player device`);
  return player;
}
