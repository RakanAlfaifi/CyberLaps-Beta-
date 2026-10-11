import { Cpu, Globe, KeyRound, Radar, ShieldHalf, type LucideIcon } from "lucide-react";
import type { ModuleId } from "./catalog";

export const MODULE_ICONS: Record<ModuleId, LucideIcon> = {
  recon: Radar,
  network: ShieldHalf,
  system: Cpu,
  crypto: KeyRound,
  web: Globe,
};
