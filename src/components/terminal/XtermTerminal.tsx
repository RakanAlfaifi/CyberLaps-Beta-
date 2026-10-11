import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { TerminalSession } from "@/terminal/TerminalSession";

/** Mounts one Smart CLI session. It survives dock moves and level changes; input follows `locked`. */
export function XtermTerminal({ locked, className }: { locked: boolean; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<TerminalSession | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const session = new TerminalSession(host);
    sessionRef.current = session;
    const observer = new ResizeObserver(() => session.fit());
    observer.observe(host);
    return () => {
      observer.disconnect();
      session.dispose();
      sessionRef.current = null;
    };
  }, []);

  useEffect(() => {
    sessionRef.current?.setLocked(locked);
  }, [locked]);

  // A shell is left-to-right in every language.
  return <div id="terminal-mount" ref={hostRef} dir="ltr" className={cn("[&_.xterm]:h-full", className)} />;
}
