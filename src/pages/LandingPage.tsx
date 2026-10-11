import { BookOpen, ExternalLink, Eye, Github, LogIn, UserPlus, Wrench, type LucideIcon } from "lucide-react";
import { useRef, useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import { DomainHub, SectionHeading } from "@/components/landing/DomainHub";
import { HeroSection } from "@/components/landing/HeroSection";
import { LoginDialog, type AccountMode } from "@/components/landing/LoginDialog";
import { OperatorAvatar } from "@/components/landing/OperatorAvatar";
import { OperatorPanel } from "@/components/landing/OperatorPanel";
import { SettingsPanel } from "@/components/landing/SettingsPanel";
import { BrandMark } from "@/components/layout/BrandMark";
import { Button } from "@/components/ui/Button";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { playSfx } from "@/core/audio";
import { useProfileStore } from "@/core/state/profileStore";
import { useT, type MessageKey } from "@/i18n";

const PILLARS: readonly { icon: LucideIcon; title: MessageKey; body: MessageKey; accent: string }[] = [
  { icon: Eye, title: "landing.pillarWatchTitle", body: "landing.pillarWatchBody", accent: "text-cyber-glow border-cyber-blue/40 bg-cyber-blue/10" },
  { icon: BookOpen, title: "landing.pillarLearnTitle", body: "landing.pillarLearnBody", accent: "text-amber-glow border-amber-neon/40 bg-amber-neon/10" },
  { icon: Wrench, title: "landing.pillarDoTitle", body: "landing.pillarDoBody", accent: "text-emerald-glow border-emerald-neon/40 bg-emerald-neon/10" },
];

const DEVELOPER_GITHUB_URL = "https://github.com/RakanAlfaifi";

/** `/`: welcome, platform intro, Domain Hub, operator profile and settings. */
export function LandingPage() {
  const t = useT();
  const [accountMode, setAccountMode] = useState<AccountMode | null>(null);
  const domainsRef = useRef<HTMLElement>(null);
  const operatorRef = useRef<HTMLElement>(null);
  const settingsRef = useRef<HTMLElement>(null);

  const scrollTo = (ref: RefObject<HTMLElement>) => {
    playSfx("click");
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="relative h-full overflow-y-auto overflow-x-hidden bg-void">
      <Backdrop />

      <LandingHeader
        onDomains={() => scrollTo(domainsRef)}
        onOperator={() => scrollTo(operatorRef)}
        onSettings={() => scrollTo(settingsRef)}
        onSignIn={() => setAccountMode("signIn")}
        onSignUp={() => setAccountMode("signUp")}
      />

      <main className="relative mx-auto max-w-6xl px-5">
        <HeroSection onExplore={() => scrollTo(domainsRef)} />

        <ul className="grid gap-4 md:grid-cols-3">
          {PILLARS.map((pillar, i) => (
            <li
              key={pillar.title}
              className="animate-fade-in-up rounded-xl border border-line bg-surface/70 p-5 backdrop-blur transition-colors hover:border-line-strong"
              style={{ animationDelay: `${0.1 + i * 0.1}s` }}
            >
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg border ${pillar.accent}`}>
                  <pillar.icon className="h-5 w-5" />
                </span>
                <h3 className="text-base font-semibold text-ink">
                  <span className="me-2 font-mono text-xs text-ink-faint">0{i + 1}</span>
                  {t(pillar.title)}
                </h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t(pillar.body)}</p>
            </li>
          ))}
        </ul>

        <DomainHub ref={domainsRef} />

        <div className="grid gap-6 pb-16 lg:grid-cols-2">
          <section ref={operatorRef} aria-labelledby="operator-title" className="flex scroll-mt-20 flex-col gap-4">
            <SectionHeading id="operator-title" title={t("landing.operatorTitle")} />
            <OperatorPanel onSignIn={() => setAccountMode("signIn")} onSignUp={() => setAccountMode("signUp")} />
          </section>
          <section ref={settingsRef} aria-labelledby="settings-title" className="flex scroll-mt-20 flex-col gap-4">
            <SectionHeading id="settings-title" title={t("landing.settingsTitle")} />
            <SettingsPanel />
          </section>
        </div>
      </main>

      <footer className="relative border-t border-line bg-surface/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-6">
          <BrandMark compact />
          <p className="max-w-xl flex-1 text-xs leading-relaxed text-ink-faint">{t("landing.footer")}</p>
          <a
            href={DEVELOPER_GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("landing.githubAria")}
            onClick={() => playSfx("click")}
            className="group inline-flex items-center gap-2 rounded-md border border-cyber-blue/40 bg-cyber-blue/10 px-3.5 py-2 text-sm font-medium text-cyber-glow transition-all hover:border-cyber-blue/70 hover:bg-cyber-blue/20 hover:shadow-glow-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-glow/60"
          >
            <Github className="h-4 w-4" />
            <span>{t("landing.github")}</span>
            <span dir="ltr" className="hidden font-mono text-xs text-ink-faint sm:inline">
              @RakanAlfaifi
            </span>
            <ExternalLink className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100 rtl:-scale-x-100" />
          </a>
        </div>
      </footer>

      <LoginDialog open={accountMode !== null} initialMode={accountMode ?? "signIn"} onClose={() => setAccountMode(null)} />
    </div>
  );
}

interface LandingHeaderProps {
  onDomains: () => void;
  onOperator: () => void;
  onSettings: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
}

function LandingHeader({ onDomains, onOperator, onSettings, onSignIn, onSignUp }: LandingHeaderProps) {
  const t = useT();
  const profile = useProfileStore((s) => s.profile);
  const links: readonly { label: MessageKey; onClick: () => void }[] = [
    { label: "landing.nav.domains", onClick: onDomains },
    { label: "landing.nav.operator", onClick: onOperator },
    { label: "landing.nav.settings", onClick: onSettings },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-void/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
        <Link to="/" className="flex items-center gap-3">
          <BrandMark />
          <span className="hidden whitespace-nowrap border-s border-line ps-3 text-[11px] uppercase tracking-[0.2em] text-ink-faint lg:inline">
            {t("brand.tagline")}
          </span>
        </Link>

        <nav aria-label={t("nav.dashboard")} className="ms-6 hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <button
              key={link.label}
              type="button"
              onClick={link.onClick}
              className="rounded-md px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-overlay hover:text-ink"
            >
              {t(link.label)}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        <LanguageToggle />

        {profile ? (
          <button
            type="button"
            onClick={onOperator}
            className="flex items-center gap-2 rounded-full border border-line py-0.5 pe-3 ps-0.5 transition-colors hover:border-line-strong hover:bg-surface-overlay"
          >
            <OperatorAvatar profile={profile} size="sm" />
            <span className="max-w-[8rem] truncate text-sm font-medium text-ink">{profile.callsign}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="whitespace-nowrap" onClick={onSignIn}>
              <LogIn className="rtl:-scale-x-100" />
              {t("profile.signIn")}
            </Button>
            <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={onSignUp}>
              <UserPlus />
              {t("profile.signUp")}
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

/** Grid, glows and a slow scanline behind the whole page. */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-grid-faint bg-grid [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div className="absolute -start-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-emerald-neon/10 blur-[120px]" />
      <div className="absolute -end-40 top-1/3 h-[28rem] w-[28rem] rounded-full bg-cyber-blue/10 blur-[120px]" />
      <div className="absolute inset-0 animate-scan bg-gradient-to-b from-transparent via-cyber-blue/[0.03] to-transparent" />
    </div>
  );
}
