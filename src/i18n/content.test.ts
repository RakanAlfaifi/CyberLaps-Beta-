import { describe, expect, it } from "vitest";
import { listComingSoonLevels, listLevelDefinitions } from "@/core/levels";
import { describePacket } from "@/core/network/packetAnatomy";
import { listToolInfo } from "@/core/tools/catalog";
import { getLesson, LESSON_SECTIONS } from "./lessons";
import { AR_LEVELS, localizeBeat, localizeLevel, localizeObjective } from "./levels";
import { ar } from "./messages/ar";
import { en } from "./messages/en";
import { AR_TOOLS, localizeTool } from "./tools";

const ARABIC = /[\u0600-\u06FF]/;

describe("Arabic content is complete", () => {
  it("has a non-empty Arabic string for every UI key", () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) expect(ar[key]?.trim(), key).toBeTruthy();
  });

  it.each(listLevelDefinitions().map((l) => [l.id, l] as const))("level %i: title, objectives and every walkthrough beat", (_, level) => {
    const copy = AR_LEVELS[level.id];
    expect(copy?.beats).toHaveLength(level.walkthrough.length);
    for (const objective of level.objectives) {
      expect(copy?.objectives?.[objective.id], objective.id).toMatch(ARABIC);
      expect(localizeObjective(level, objective.id, "ar")).toMatch(ARABIC);
      expect(localizeObjective(level, objective.id, "en")).toBe(objective.text);
    }
    level.walkthrough.forEach((beat, i) => {
      expect(localizeBeat(level, i, "ar")).toMatch(ARABIC);
      expect(localizeBeat(level, i, "en")).toBe(beat.text);
    });
    expect(localizeLevel(level, "ar").title).toMatch(ARABIC);
  });

  it("translates coming-soon levels", () => {
    for (const level of listComingSoonLevels()) expect(localizeLevel(level, "ar").title).toMatch(ARABIC);
  });

  it("translates every tool guide, including each syntax part", () => {
    for (const tool of listToolInfo()) {
      expect(AR_TOOLS[tool.id], tool.id).toBeDefined();
      const local = localizeTool(tool, "ar");
      expect(local.greeting).toMatch(ARABIC);
      expect(local.howItWorks).toHaveLength(tool.howItWorks.length);
      for (const part of tool.parts) expect(AR_TOOLS[tool.id].parts[part.token], `${tool.id} ${part.token}`).toMatch(ARABIC);
      expect(local.syntax).toBe(tool.syntax);
    }
  });

  it.each(listLevelDefinitions().map((l) => l.id))("level %i has a full lesson in both languages", (id) => {
    for (const language of ["en", "ar"] as const) {
      const lesson = getLesson(id, language);
      for (const section of LESSON_SECTIONS) {
        expect(lesson?.[section].length, `${language} ${section}`).toBeGreaterThanOrEqual(3);
        if (language === "ar") lesson?.[section].forEach((p) => expect(p).toMatch(ARABIC));
      }
    }
  });

  it("explains packets in Arabic in the X-Ray", () => {
    const topology = listLevelDefinitions()[3].topology;
    const a = describePacket({ srcId: "you", dstId: "web", protocol: "tcp", srcPort: 50000, dstPort: 80, outcome: "success" }, topology, "ar");
    expect(a.summary).toMatch(ARABIC);
    expect(a.verdict.title).toMatch(ARABIC);
    for (const layer of [...a.request, ...(a.reply ?? [])]) {
      expect(layer.role).toMatch(ARABIC);
      for (const field of layer.fields) expect(field.explain).toMatch(ARABIC);
    }
  });
});
