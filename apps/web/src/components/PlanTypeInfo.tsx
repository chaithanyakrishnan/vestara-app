import { LIMITS_CHIPS, IRS_LIMITS_YEAR, planProfile, type PlanType } from "@vestara/shared";

/**
 * The indexed IRS dollar limits, shown above the plan-type selector so the
 * numbers the elections are made against are visible while they are made.
 *
 * Values come from IRS_LIMITS in @vestara/shared — the annual update is one
 * edit there, not a search through JSX.
 */
export function IrsLimitsStrip() {
  return (
    <div className="limits-strip" role="note" aria-label={`${IRS_LIMITS_YEAR} IRS limits`}>
      <span className="limits-strip-year">{IRS_LIMITS_YEAR} IRS limits</span>
      <div className="limits-strip-items">
        {LIMITS_CHIPS.map((chip) => (
          <span className="limits-chip" key={chip.label}>
            <span className="limits-chip-label">{chip.label}</span>
            <span className="limits-chip-value">{chip.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * What the selected plan type actually commits the sponsor to.
 *
 * This is the counterpart to making the schemas plan-type aware: the wizard now
 * asks different questions per type, and this panel is where the user is told
 * why. The copy lives on the profile in @vestara/shared so the rules and the
 * explanation of the rules cannot drift apart.
 */
export function PlanTypeDescription({ planType }: { planType: PlanType | string | undefined }) {
  const p = planProfile(planType);

  return (
    <div className={`plan-type-panel plan-type-${p.key}`}>
      <div className="plan-type-panel-head">{p.headline}</div>
      <p className="plan-type-panel-summary">{p.summary}</p>
      {p.notes.length > 0 && (
        <ul className="plan-type-panel-notes">
          {p.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
