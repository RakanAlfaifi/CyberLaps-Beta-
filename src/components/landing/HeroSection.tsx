import { ChevronLeft, ChevronRight, Compass, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useProfileStore } from "@/core/state/profileStore";
import { useT, type MessageKey } from "@/i18n";
import { useReconSummary } from "./useReconSummary";

const CONSOLE_LINES: readonly { text: string; tone: string }[] = [
  { text: "$ ping -c 1 10.0.0.1", tone: "text-ink" },
  { text: "64 bytes from 10.0.0.1: icmp_seq=1 ttl=64 time=0.42 ms", tone: "text-emerald-glow" },
  { text: "$ arp-scan --localnet", tone: "text-ink" },
  { text: "10.0.0.20   3c:22:fb:9a:10:4e   alice-laptop", tone: "text-cyber-glow" },
  { text: "10.0.0.50   b8:27:eb:44:aa:01   web-server", tone: "text-cyber-glow" },
  { text: "$ nmap -p 22,80,443 10.0.0.50", tone: "text-ink" },
  { text: "22/tcp   closed   ssh", tone: "text-danger-glow" },
  { text: "80/tcp   open     http", tone: "text-emerald-glow" },
  { text: "443/tcp  filtered https", tone: "text-amber-glow" },
];

export function HeroSection({ onExplore }: { onExplore: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const profile = useProfileStore((s) => s.profile);
  const recon = useReconSummary();
  const Forward = t.dir === "rtl" ? ChevronLeft : ChevronRight;

  const stats: readonly { value: string; label: MessageKey; tone: string }[] = [
    { value: t.num(recon.total), label: "landing.statLevels", tone: "text-cyber-glow" },
    { value: t.num(3), label: "landing.statTools", tone: "text-emerald-glow" },
    { value: `${t.num(recon.doneCount)}/${t.num(recon.total)}`, label: "landing.statDone", tone: "text-amber-glow" },
    { value: t.num(recon.devicesFound), label: "landing.statDevices", tone: "text-cyber-glow" },
  ];

  return (
    <section className="relative grid items-center gap-12 py-12 lg:grid-cols-[1.1fr_1fr] lg:py-20">
      <div className="flex flex-col gap-6">
        <p className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-neon/30 bg-emerald-neon/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-glow">
          <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-emerald-neon" />
          {t("landing.heroEyebrow")}
        </p>

        <p className="text-sm font-medium text-ink-muted">
          {profile ? t("landing.welcomeBack", { name: profile.callsign }) : t("landing.welcomeGuest")}
        </p>

        {/*
          Line height lives on the spans: the text-*xl sizes carry their own line-height of 1, which would
          override it on the h1. Gradient text is only painted inside its own box, so that box must also
          cover the tails of Arabic glyphs.
        */}
        <h1 className="text-4xl font-bold text-ink sm:text-5xl lg:text-6xl">
          <span className="block leading-[1.2] rtl:leading-[1.5]">{t("landing.heroTitleA")}</span>
          <span className="block bg-gradient-to-r from-emerald-glow via-cyber-glow to-emerald-neon bg-clip-text pb-[0.12em] leading-[1.2] text-transparent [box-decoration-break:clone] rtl:bg-gradient-to-l rtl:pb-[0.2em] rtl:leading-[1.5]">
            {t("landing.heroTitleB")}
          </span>
        </h1>

        <p className="max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">{t("landing.heroBody")}</p>

        <div className="flex flex-wrap items-center gap-3">
          <Button sfx="success" className="h-11 px-6 text-base shadow-glow-emerald" onClick={() => navigate(`/lab/${recon.started ? recon.currentLevelId : 1}`)}>
            <Play className="rtl:-scale-x-100" />
            {recon.started ? t("landing.continue", { n: recon.currentLevelId }) : t("landing.start")}
          </Button>
          <Button variant="secondary" className="h-11 px-5" onClick={onExplore}>
            <Compass />
            {t("landing.explore")}
            <Forward />
          </Button>
        </div>

        <dl className="grid max-w-xl grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="clip-corner border border-line bg-surface/70 px-3 py-2.5">
              <dt className="text-[11px] text-ink-faint">{t(s.label)}</dt>
              <dd className={`font-mono text-xl font-semibold ${s.tone}`}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <HeroConsole />
    </section>
  );
}

/** Decorative scan replay: a radar sweep behind a terminal that types itself out. */
function HeroConsole() {
  const t = useT();
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-lg animate-float">
      <div className="absolute -inset-10 -z-10 rounded-full bg-cyber-blue/10 blur-3xl" />
      <svg viewBox="0 0 200 200" className="absolute -top-16 end-[-3rem] -z-10 h-64 w-64 opacity-60">
        <defs>
          <radialGradient id="radar-fade">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="radar-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#34D399" stopOpacity="0" />
            <stop offset="100%" stopColor="#34D399" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="96" fill="url(#radar-fade)" />
        {[30, 60, 90].map((r) => (
          <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#10B981" strokeOpacity="0.25" />
        ))}
        <line x1="4" y1="100" x2="196" y2="100" stroke="#10B981" strokeOpacity="0.2" />
        <line x1="100" y1="4" x2="100" y2="196" stroke="#10B981" strokeOpacity="0.2" />
        <g className="animate-spin-slow" style={{ transformBox: "view-box", transformOrigin: "100px 100px" }}>
          <path d="M100 100 L196 100 A96 96 0 0 0 167.9 32.1 Z" fill="url(#radar-sweep)" />
        </g>
        <circle cx="140" cy="60" r="3" fill="#34D399" className="animate-pulse-glow" />
        <circle cx="62" cy="128" r="3" fill="#60A5FA" className="animate-pulse-glow" />
        <circle cx="150" cy="140" r="3" fill="#FBBF24" className="animate-pulse-glow" />
      </svg>

      <div dir="ltr" className="overflow-hidden rounded-xl border border-line-strong bg-void/90 shadow-panel backdrop-blur">
        <div className="flex items-center gap-1.5 border-b border-line bg-surface/80 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-danger-neon/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-neon/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-neon/80" />
          <span className="ms-3 font-mono text-[11px] text-ink-faint">analyst@cyberlaps:~</span>
          <span className="ms-auto flex items-center gap-1 font-mono text-[10px] uppercase text-emerald-glow" dir={t.dir}>
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-emerald-neon" />
            {t("landing.terminalDemo")}
          </span>
        </div>
        <div className="relative flex flex-col gap-1 px-4 py-4 font-mono text-[12.5px] leading-relaxed">
          <div className="pointer-events-none absolute inset-0 animate-scan bg-gradient-to-b from-transparent via-emerald-neon/[0.05] to-transparent" />
          {CONSOLE_LINES.map((line, i) => (
            <p key={line.text} className={`animate-type-in whitespace-pre ${line.tone}`} style={{ animationDelay: `${0.35 + i * 0.32}s` }}>
              {line.text}
            </p>
          ))}
          <p className="animate-type-in text-ink" style={{ animationDelay: `${0.35 + CONSOLE_LINES.length * 0.32}s` }}>
            $ <span className="inline-block h-4 w-2 translate-y-0.5 animate-blink bg-emerald-neon" />
          </p>
        </div>
      </div>
    </div>
  );
}
