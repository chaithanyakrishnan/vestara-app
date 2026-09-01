import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@vestara/shared";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setSession: (token: string, user: AuthUser) => void;
  clearSession: () => void;
}

// Persisted to localStorage so a refresh mid-wizard doesn't force a re-login —
// the wizard *data* is server-side (resumable via the draft), but the
// session token itself is fine to keep client-side for a dev-scale app.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      clearSession: () => set({ token: null, user: null }),
    }),
    { name: "vestara-auth" },
  ),
);
