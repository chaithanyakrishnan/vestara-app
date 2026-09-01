import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLogin } from "../hooks/useAuth";
import { ApiClientError } from "../lib/apiClient";

/** Matches the users created by apps/api/prisma/seed.ts. */
const DEMO_CREDS = {
  sponsor: { email: "murthy@altimetrik1.com", password: "demo1234" },
  advisor: { email: "chai@lpl.com", password: "demo1234" },
};

type Role = keyof typeof DEMO_CREDS;

const ROLE_COPY: Record<Role, { title: string; desc: string }> = {
  sponsor: {
    title: "Plan Sponsor",
    desc: "Set up a new or restated 401(k) plan for your organization.",
  },
  advisor: {
    title: "Advisor / TPA",
    desc: "Onboard client plans, manage fund lineups, and generate plan documents.",
  },
};

export function LoginPage() {
  const [profile, setProfile] = useState<Role | null>(null);
  // Real, editable fields. Previously the page posted DEMO_CREDS invisibly
  // while claiming credentials were "pre-filled" — nothing was ever shown.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();
  const navigate = useNavigate();

  function pick(role: Role) {
    setProfile(role);
    setEmail(DEMO_CREDS[role].email);
    setPassword(DEMO_CREDS[role].password);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    await login.mutateAsync({ email, password });
    navigate("/dashboard");
  }

  const errorMessage =
    login.error instanceof ApiClientError
      ? login.error.message
      : login.error
        ? (login.error as Error).message
        : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: "40px 20px",
      }}
    >
      <div style={{ fontFamily: "Fraunces, serif", fontSize: 28, fontWeight: 300 }}>
        Sign in to <em>Vestara.</em>
      </div>
      <div style={{ color: "var(--cream2)", textAlign: "center", maxWidth: 380 }}>
        Select your profile to pre-fill the demo credentials, then sign in.
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
        {(Object.keys(ROLE_COPY) as Role[]).map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => pick(role)}
            aria-pressed={profile === role}
            style={{
              padding: "18px 20px",
              borderRadius: 12,
              border: `1.5px solid ${profile === role ? "var(--green)" : "rgba(20,36,28,.12)"}`,
              background: profile === role ? "rgba(75,205,62,.08)" : "#fff",
              minWidth: 210,
              maxWidth: 240,
              textAlign: "left",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{ROLE_COPY[role].title}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
              {ROLE_COPY[role].desc}
            </div>
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 14, width: 340, maxWidth: "100%" }}
      >
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={email ? "has-value" : undefined}
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Password</label>
          <div className="input-wrap">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`with-suffix${password ? " has-value" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              style={{
                position: "absolute",
                right: 8,
                background: "none",
                border: "none",
                color: "var(--muted)",
                fontSize: 11,
                fontWeight: 600,
                padding: 4,
              }}
            >
              {showPassword ? "HIDE" : "SHOW"}
            </button>
          </div>
        </div>

        {errorMessage && <div className="inline-alert error">{errorMessage}</div>}

        <button
          className="btn-primary"
          type="submit"
          style={{ justifyContent: "center" }}
          disabled={!email || !password || login.isPending}
        >
          {login.isPending ? "Signing in…" : "Sign In"}
        </button>

        <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
          Demo mode — picking a profile fills in that seeded user's credentials. You can edit them or sign
          in with any other account.
        </div>
      </form>
    </div>
  );
}
