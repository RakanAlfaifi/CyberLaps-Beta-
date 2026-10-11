import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getBrowserStorage, storageKey } from "@/core/persistence/storage";

export interface OperatorProfile {
  callsign: string;
  /** 0..359, picks the avatar color. */
  avatarHue: number;
  joinedAt: number;
}

/** A callsign registered in this browser. Passwords are never stored. */
export interface RegisteredAccount {
  callsign: string;
  joinedAt: number;
}

export const CALLSIGN_PATTERN = /^[\p{L}\p{N}_-]{3,20}$/u;
export const MIN_PASSWORD_LENGTH = 6;

export type LoginError = "callsign" | "password";
export type RegisterError = LoginError | "mismatch" | "taken";

/** Mock sign-in rules. Nothing is sent anywhere and the password is never stored. */
export function validateLogin(callsign: string, password: string): LoginError | null {
  if (!CALLSIGN_PATTERN.test(callsign.trim())) return "callsign";
  if (password.length < MIN_PASSWORD_LENGTH) return "password";
  return null;
}

export function validateRegistration(
  callsign: string,
  password: string,
  confirm: string,
  accounts: readonly RegisteredAccount[],
): RegisterError | null {
  const basic = validateLogin(callsign, password);
  if (basic) return basic;
  if (password !== confirm) return "mismatch";
  const key = callsign.trim().toLowerCase();
  if (accounts.some((a) => a.callsign.toLowerCase() === key)) return "taken";
  return null;
}

const hueOf = (text: string) => [...text].reduce((h, ch) => (h * 31 + ch.codePointAt(0)!) % 360, 7);

const profileOf = (callsign: string, joinedAt: number): OperatorProfile => ({
  callsign,
  avatarHue: hueOf(callsign.toLowerCase()),
  joinedAt,
});

interface ProfileState {
  profile: OperatorProfile | null;
  accounts: RegisteredAccount[];
  /** Returns the reason it refused, or null when signed in. */
  signIn: (callsign: string, password: string) => LoginError | null;
  /** Creates a local account and signs in. Returns the reason it refused, or null. */
  register: (callsign: string, password: string, confirm: string) => RegisterError | null;
  signOut: () => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: null,
      accounts: [],

      signIn: (callsign, password) => {
        const error = validateLogin(callsign, password);
        if (error) return error;
        const name = callsign.trim();
        const account = get().accounts.find((a) => a.callsign.toLowerCase() === name.toLowerCase());
        set({ profile: profileOf(account?.callsign ?? name, account?.joinedAt ?? Date.now()) });
        return null;
      },

      register: (callsign, password, confirm) => {
        const error = validateRegistration(callsign, password, confirm, get().accounts);
        if (error) return error;
        const account = { callsign: callsign.trim(), joinedAt: Date.now() };
        set((s) => ({ accounts: [...s.accounts, account], profile: profileOf(account.callsign, account.joinedAt) }));
        return null;
      },

      signOut: () => set({ profile: null }),
    }),
    {
      name: storageKey("profile"),
      version: 2,
      storage: createJSONStorage(getBrowserStorage),
      partialize: (s) => ({ profile: s.profile, accounts: s.accounts }),
      migrate: (persisted) => {
        const saved = (persisted ?? {}) as Partial<Pick<ProfileState, "profile" | "accounts">>;
        return { profile: saved.profile ?? null, accounts: saved.accounts ?? [] };
      },
    },
  ),
);
