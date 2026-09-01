import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { STEP_REGISTRY } from "@vestara/shared";
import { usePlan } from "../../hooks/usePlan";

/**
 * Rail + step routing shell. Each step is its own route
 * (/onboarding/:planId/step/:stepKey) rather than a client-side index into
 * an array, so a step is directly linkable/bookmarkable and a refresh
 * lands back on the right step — the resumability the original prototype
 * couldn't offer since everything lived in one big in-memory `S` object.
 */
export function WizardLayout() {
  const { planId } = useParams();
  const { data: plan } = usePlan(planId);
  const navigate = useNavigate();

  const maxStepReached = plan?.maxStepReached ?? 0;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav
        style={{
          width: 260,
          background: "#fff",
          borderRight: "1px solid rgba(20,36,28,.06)",
          padding: "32px 0",
          flexShrink: 0,
        }}
      >
        <div style={{ padding: "0 24px", fontWeight: 700, marginBottom: 28 }}>Vestara</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {STEP_REGISTRY.map((step) => {
            const locked = step.index > maxStepReached;
            return (
              <NavLink
                key={step.key}
                to={locked ? "#" : `/onboarding/${planId}/step/${step.key}`}
                onClick={(e) => locked && e.preventDefault()}
                style={({ isActive }) => ({
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 24px",
                  opacity: locked ? 0.35 : 1,
                  background: isActive ? "rgba(11,92,66,.06)" : "transparent",
                  color: "var(--cream)",
                  textDecoration: "none",
                  fontSize: 13,
                })}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    background: step.index <= maxStepReached ? "var(--teal2)" : "rgba(20,36,28,.08)",
                    color: step.index <= maxStepReached ? "#fff" : "var(--muted)",
                  }}
                >
                  {step.index + 1}
                </span>
                {step.label}
              </NavLink>
            );
          })}
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              padding: "10px 24px",
              opacity: maxStepReached >= STEP_REGISTRY.length ? 1 : 0.35,
              fontSize: 13,
              cursor: maxStepReached >= STEP_REGISTRY.length ? "pointer" : "default",
            }}
            onClick={() => maxStepReached >= STEP_REGISTRY.length && navigate(`/onboarding/${planId}/review`)}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                background: "rgba(20,36,28,.08)",
                color: "var(--muted)",
              }}
            >
              {STEP_REGISTRY.length + 1}
            </span>
            Review & Sign
          </div>
        </div>
        <div style={{ padding: "24px", marginTop: 20 }}>
          <button className="btn-back" style={{ width: "100%" }} onClick={() => navigate("/dashboard")}>
            ← Dashboard
          </button>
        </div>
      </nav>
      <main style={{ flex: 1, padding: "40px 48px", overflowY: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
