import { z } from "zod";
import catalog from "@/content/tools/catalog.json";

const toolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().min(1),
  /** First-person hello the tool says in the Lab Agent intro. */
  greeting: z.string().min(1),
  howItWorks: z.array(z.string().min(1)).min(1),
  syntax: z.string().min(1),
  /** The syntax split into pieces, each explained in plain words. */
  parts: z.array(z.object({ token: z.string().min(1), meaning: z.string().min(1) })).min(1),
  example: z.string().min(1),
  tip: z.string().optional(),
  summary: z.string().min(1),
});

export type ToolInfo = z.infer<typeof toolSchema>;

const TOOLS: ReadonlyMap<string, ToolInfo> = new Map(
  Object.entries(z.record(toolSchema).parse(catalog)).map(([key, tool]) => {
    if (key !== tool.id) throw new Error(`Tool catalog key "${key}" does not match its id "${tool.id}"`);
    return [key, tool] as const;
  }),
);

export function getToolInfo(id: string): ToolInfo | undefined {
  return TOOLS.get(id);
}

export function listToolInfo(): ToolInfo[] {
  return [...TOOLS.values()];
}
