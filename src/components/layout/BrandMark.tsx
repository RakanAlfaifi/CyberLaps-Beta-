import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";

/** The CyberLaps wordmark. It is a name, so it stays Latin and left-to-right in every language. */
export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span dir="ltr" className={cn("flex items-center gap-2", className)}>
      <ShieldCheck className={cn("text-emerald-neon", compact ? "h-5 w-5" : "h-7 w-7")} />
      <span
        className={cn(
          "font-mono font-semibold text-ink",
          compact ? "text-sm tracking-[0.25em]" : "text-lg tracking-[0.3em]",
        )}
      >
        CYBER<span className="text-emerald-neon">LAPS</span>
      </span>
    </span>
  );
}
