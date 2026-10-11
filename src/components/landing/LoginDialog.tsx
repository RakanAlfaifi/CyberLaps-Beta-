import { KeyRound, LogIn, ShieldCheck, UserPlus, UserRound, type LucideIcon } from "lucide-react";
import { useId, useLayoutEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { playSfx } from "@/core/audio";
import { MIN_PASSWORD_LENGTH, useProfileStore, type RegisterError } from "@/core/state/profileStore";
import { useT, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";

export type AccountMode = "signIn" | "signUp";

const MODES: Record<AccountMode, { tab: MessageKey; title: MessageKey; body: MessageKey; submit: MessageKey; icon: LucideIcon }> = {
  signIn: { tab: "login.tabSignIn", title: "login.title", body: "login.body", submit: "login.submit", icon: LogIn },
  signUp: { tab: "login.tabSignUp", title: "register.title", body: "register.body", submit: "register.submit", icon: UserPlus },
};

const ERROR_FIELD: Record<RegisterError, "callsign" | "password" | "confirm"> = {
  callsign: "callsign",
  taken: "callsign",
  password: "password",
  mismatch: "confirm",
};

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  /** Which tab is shown when the dialog opens. */
  initialMode?: AccountMode;
}

export function LoginDialog({ open, onClose, initialMode = "signIn" }: LoginDialogProps) {
  const t = useT();
  const signIn = useProfileStore((s) => s.signIn);
  const register = useProfileStore((s) => s.register);
  const [mode, setMode] = useState<AccountMode>(initialMode);
  const [callsign, setCallsign] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<RegisterError | null>(null);
  const callsignId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const errorId = useId();
  const tabsId = useId();

  useLayoutEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setPassword("");
    setConfirm("");
    setError(null);
  }, [open, initialMode]);

  const switchMode = (next: AccountMode) => {
    if (next === mode) return;
    playSfx("click");
    setMode(next);
    setPassword("");
    setConfirm("");
    setError(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = mode === "signIn" ? signIn(callsign, password) : register(callsign, password, confirm);
    setError(result);
    if (result) {
      playSfx("reject");
      return;
    }
    playSfx("success");
    setPassword("");
    setConfirm("");
    onClose();
  };

  const errorText = (e: RegisterError) => {
    switch (e) {
      case "callsign":
        return t("login.errorCallsign");
      case "password":
        return t("login.errorPassword", { n: t.num(MIN_PASSWORD_LENGTH) });
      case "mismatch":
        return t("register.errorMismatch");
      case "taken":
        return t("register.errorTaken");
    }
  };

  const invalid = (field: "callsign" | "password" | "confirm") => error !== null && ERROR_FIELD[error] === field;
  const field =
    "w-full rounded-md border bg-void/80 py-2 pe-3 ps-9 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-cyber-blue/60 focus:outline-none";
  const copy = MODES[mode];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(copy.title)}
      description={t(copy.body)}
      closeLabel={t("common.close")}
      icon={<copy.icon className="text-cyber-glow" />}
    >
      <div role="tablist" aria-label={t("login.tabsAria")} className="mb-4 grid grid-cols-2 gap-1 rounded-md border border-line bg-void/60 p-1">
        {(Object.keys(MODES) as AccountMode[]).map((id) => {
          const selected = id === mode;
          const Icon = MODES[id].icon;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${tabsId}-${id}`}
              aria-selected={selected}
              aria-controls={`${tabsId}-panel`}
              onClick={() => switchMode(id)}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors",
                selected ? "bg-cyber-blue/15 text-cyber-glow shadow-glow-blue" : "text-ink-muted hover:bg-surface-overlay hover:text-ink",
              )}
            >
              <Icon className="h-3.5 w-3.5 rtl:-scale-x-100" />
              {t(MODES[id].tab)}
            </button>
          );
        })}
      </div>

      <form
        id={`${tabsId}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-${mode}`}
        onSubmit={submit}
        noValidate
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={callsignId} className="text-xs font-medium text-ink-muted">
            {t("login.callsign")}
          </label>
          <div className="relative">
            <UserRound aria-hidden className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              id={callsignId}
              autoFocus
              autoComplete="username"
              value={callsign}
              maxLength={20}
              placeholder={t("login.callsignPlaceholder")}
              aria-invalid={invalid("callsign")}
              aria-describedby={invalid("callsign") ? errorId : undefined}
              onChange={(e) => setCallsign(e.target.value)}
              className={cn(field, invalid("callsign") ? "border-danger-neon/60" : "border-line-strong")}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={passwordId} className="text-xs font-medium text-ink-muted">
            {t("login.password")}
          </label>
          <div className="relative">
            <KeyRound aria-hidden className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              id={passwordId}
              type="password"
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              value={password}
              aria-invalid={invalid("password")}
              aria-describedby={invalid("password") ? errorId : undefined}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(field, invalid("password") ? "border-danger-neon/60" : "border-line-strong")}
            />
          </div>
        </div>

        {mode === "signUp" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={confirmId} className="text-xs font-medium text-ink-muted">
              {t("register.confirm")}
            </label>
            <div className="relative">
              <ShieldCheck aria-hidden className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                id={confirmId}
                type="password"
                autoComplete="new-password"
                value={confirm}
                aria-invalid={invalid("confirm")}
                aria-describedby={invalid("confirm") ? errorId : undefined}
                onChange={(e) => setConfirm(e.target.value)}
                className={cn(field, invalid("confirm") ? "border-danger-neon/60" : "border-line-strong")}
              />
            </div>
          </div>
        )}

        {error && (
          <p id={errorId} role="alert" className="text-xs text-danger-glow">
            {errorText(error)}
          </p>
        )}

        <Button type="submit" sfx={false} className="w-full">
          <copy.icon className="rtl:-scale-x-100" />
          {t(copy.submit)}
        </Button>
      </form>
    </Dialog>
  );
}
