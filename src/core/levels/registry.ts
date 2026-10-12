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

const describeIssues = (issues: readonly { path: (string | number)[]; message: string }[]) =>
  issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");

/**
 * Validates raw level files into a registry keyed by level number.
 *
 * A file that fails validation (or whose number is already taken) is skipped
 * with a console warning, so one broken level never stops the app from booting.
 * It simply does not appear in the level list.
 *
 * @param files Raw JSON level files, in load order.
 * @returns The levels that passed validation.
 */
export function buildLevelRegistry(files: readonly unknown[]): ReadonlyMap<LevelId, LevelDefinition> {
  const levels = new Map<LevelId, LevelDefinition>();
  files.forEach((raw, index) => {
    try {
      const result = levelFileSchema.safeParse(raw);
      if (!result.success) {
        console.warn(`[levels] Skipping level file #${index + 1}: ${describeIssues(result.error.issues)}`);
        return;
      }
      const level = toDefinition(result.data);
      if (levels.has(level.id)) {
        console.warn(`[levels] Skipping level file #${index + 1}: level ${level.id} is already defined`);
        return;
      }
      levels.set(level.id, level);
    } catch (error) {
      console.warn(`[levels] Skipping level file #${index + 1}: failed to load`, error);
    }
  });
  return levels;
}

const LEVELS = buildLevelRegistry(LEVEL_FILES);

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

/**
 * Validates the Coming Soon file, dropping entries that are already playable.
 * An invalid file yields an empty list (with a console warning) rather than an error.
 *
 * @param raw The raw Coming Soon JSON.
 * @param playable Registry of playable levels; their numbers are excluded.
 */
export function buildComingSoonList(
  raw: unknown,
  playable: ReadonlyMap<LevelId, LevelDefinition>,
): readonly ComingSoonLevel[] {
  const result = comingSoonFileSchema.safeParse(raw);
  if (!result.success) {
    console.warn(`[levels] Ignoring Coming Soon file: ${describeIssues(result.error.issues)}`);
    return [];
  }
  return result.data.levels
    .map((l) => ({ id: l.number, title: l.title, summary: l.summary }))
    .filter((l) => !playable.has(l.id))
    .sort((a, b) => a.id - b.id);
}

const COMING_SOON = buildComingSoonList(comingSoon, LEVELS);

export function listComingSoonLevels(): readonly ComingSoonLevel[] {
  return COMING_SOON;
}

export function getPlayerDevice(level: LevelDefinition): NetworkDevice {
  const player = level.topology.devices.find((d) => d.isPlayer);
  if (!player) throw new Error(`Level ${level.id} has no player device`);
  return player;
}
