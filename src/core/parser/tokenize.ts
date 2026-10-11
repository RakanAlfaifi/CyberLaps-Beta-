import type { Diagnostic, Token } from "./ast";

/** Shell operators the lab does not support. Caught here so the error points at the symbol. */
const OPERATORS = new Set(["|", ";", "&", ">", "<"]);

export type TokenizeResult = { ok: true; tokens: Token[] } | { ok: false; error: Diagnostic };

/** Splits on whitespace, honoring '...' and "..." quotes. Every token keeps its position. */
export function tokenize(source: string): TokenizeResult {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    if (/\s/.test(source[i])) {
      i++;
      continue;
    }

    const start = i;
    let text = "";
    while (i < source.length && !/\s/.test(source[i])) {
      const ch = source[i];
      if (ch === '"' || ch === "'") {
        const close = source.indexOf(ch, i + 1);
        if (close === -1) {
          return {
            ok: false,
            error: {
              message: `This ${ch} quote is never closed.`,
              span: { start: i, end: source.length },
              hint: `Add a matching ${ch} at the end, or remove it.`,
            },
          };
        }
        text += source.slice(i + 1, close);
        i = close + 1;
        continue;
      }
      if (OPERATORS.has(ch)) {
        return {
          ok: false,
          error: {
            message: `The lab terminal runs one command at a time, so "${ch}" is not allowed.`,
            span: { start: i, end: i + 1 },
            hint: "Type one command, press Enter, then type the next one.",
          },
        };
      }
      text += ch;
      i++;
    }
    tokens.push({ text, span: { start, end: i } });
  }

  return { ok: true, tokens };
}
