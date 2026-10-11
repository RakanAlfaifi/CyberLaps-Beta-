import type { ITheme } from "@xterm/xterm";
import type { OutputLine, Tone } from "@/core/commands";

const ESC = "\x1b[";
export const RESET = `${ESC}0m`;

/** SGR codes per tone. The bright colors are mapped to the lab palette in TERMINAL_THEME. */
const TONE_SGR: Record<Tone, string> = {
  plain: "",
  muted: "90",
  heading: "1;97",
  info: "94",
  success: "92",
  warning: "93",
  error: "91",
  tip: "37",
};

export const paint = (text: string, sgr: string) => (sgr && text ? `${ESC}${sgr}m${text}${RESET}` : text);

export function renderLine(segments: OutputLine): string {
  if (segments.length === 1 && segments[0].tone === "tip") return `${paint("› ", "96")}${paint(segments[0].text, TONE_SGR.tip)}`;
  return segments.map((s) => paint(s.text, TONE_SGR[s.tone ?? "plain"])).join("");
}

export const PROMPT = `${paint("analyst@cyberlaps", "1;92")}:${paint("~", "1;94")}$ `;
export const PROMPT_WIDTH = "analyst@cyberlaps:~$ ".length;

/** Same color meanings as tailwind.config.ts: green ok, blue activity, amber warning, red error. */
export const TERMINAL_THEME: ITheme = {
  background: "#00000000",
  foreground: "#E5E7EB",
  cursor: "#34D399",
  cursorAccent: "#0B0F19",
  selectionBackground: "rgba(96, 165, 250, 0.35)",
  black: "#0B0F19",
  red: "#EF4444",
  green: "#10B981",
  yellow: "#F59E0B",
  blue: "#3B82F6",
  magenta: "#A78BFA",
  cyan: "#22D3EE",
  white: "#9CA3AF",
  brightBlack: "#6B7280",
  brightRed: "#F87171",
  brightGreen: "#34D399",
  brightYellow: "#FBBF24",
  brightBlue: "#60A5FA",
  brightMagenta: "#C4B5FD",
  brightCyan: "#67E8F9",
  brightWhite: "#F9FAFB",
};
