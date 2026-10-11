import type { MessageKey } from "@/i18n";

export type ModuleId = "recon" | "network" | "system" | "crypto" | "web";

export interface TrainingModule {
  id: ModuleId;
  titleKey: MessageKey;
  shortKey: MessageKey;
  summaryKey: MessageKey;
  available: boolean;
}

const moduleOf = (id: ModuleId, available: boolean): TrainingModule => ({
  id,
  titleKey: `domain.${id}.title`,
  shortKey: `domain.${id}.short`,
  summaryKey: `domain.${id}.summary`,
  available,
});

/** Training domains, in display order. Only Recon is built; the rest are announced. */
export const TRAINING_MODULES: readonly TrainingModule[] = [
  moduleOf("recon", true),
  moduleOf("network", false),
  moduleOf("system", false),
  moduleOf("crypto", false),
  moduleOf("web", false),
];
