import { Award, CalendarDays, LogIn, LogOut, MapPin, Radar, UserPlus } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getLevelDefinition } from "@/core/levels";
import { useProfileStore } from "@/core/state/profileStore";
import { localizeLevel, useT } from "@/i18n";
import { OperatorAvatar } from "./OperatorAvatar";
import { useReconSummary } from "./useReconSummary";

export function OperatorPanel({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  const t = useT();
  const profile = useProfileStore((s) => s.profile);
  const signOut = useProfileStore((s) => s.signOut);
  const recon = useReconSummary();
  const level = getLevelDefinition(recon.currentLevelId);
  const joined = profile ? new Intl.DateTimeFormat(t.language, { dateStyle: "medium" }).format(profile.joinedAt) : null;

  return (
    <article className="flex h-full flex-col gap-5 rounded-xl border border-line bg-surface/80 p-6 shadow-panel">
      <div className="flex items-center gap-4">
        <OperatorAvatar profile={profile} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-ink">{profile?.callsign ?? t("profile.guest")}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone={profile ? "emerald" : "neutral"}>
              <Award className="h-3 w-3" />
              {t(recon.rankKey)}
            </Badge>
            {joined && (
              <span className="flex items-center gap-1 text-xs text-ink-faint">
                <CalendarDays className="h-3.5 w-3.5" />
                {t("profile.joined", { date: joined })}
              </span>
            )}
          </div>
        </div>
      </div>

      {!profile && <p className="text-sm leading-relaxed text-ink-muted">{t("profile.guestBody")}</p>}

      <dl className="grid grid-cols-3 gap-3">
        <Stat icon={<Award />} label={t("landing.statDone")} value={`${t.num(recon.doneCount)}/${t.num(recon.total)}`} />
        <Stat icon={<Radar />} label={t("landing.statDevices")} value={t.num(recon.devicesFound)} />
        <Stat icon={<MapPin />} label={t("profile.current")} value={t.num(recon.currentLevelId)} />
      </dl>

      {level && (
        <p className="truncate rounded-md border border-line bg-void/60 px-3 py-2 text-xs text-ink-muted">
          <span className="font-mono text-cyber-glow">{String(level.id).padStart(2, "0")}</span>
          <span className="mx-2 text-ink-faint">·</span>
          {localizeLevel(level, t.language).title}
        </p>
      )}

      <div className="mt-auto">
        {profile ? (
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="rtl:-scale-x-100" />
            {t("profile.signOut")}
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onSignIn}>
              <LogIn className="rtl:-scale-x-100" />
              {t("profile.signIn")}
            </Button>
            <Button variant="primary" onClick={onSignUp}>
              <UserPlus />
              {t("profile.signUp")}
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-void/60 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-[11px] text-ink-faint [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="font-mono text-lg font-semibold text-ink">{value}</dd>
    </div>
  );
}
