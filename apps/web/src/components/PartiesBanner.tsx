/**
 * The parties on the plan, shown above every wizard step.
 *
 * Onboarding is a multi-party document: the sponsor makes the elections, the
 * advisor is on the record for them, and a TPA may draft and file. Naming them
 * on every step keeps it obvious who this plan belongs to and who will be asked
 * to sign — the wizard is long enough that the gate screen is easily forgotten
 * by step 4.
 *
 * Copy note: this deliberately says "e-signature" rather than naming DocuSign.
 * `esign.service.ts` is the only file that knows which vendor is in use, and
 * with no credentials configured sends are simulated — promising a specific
 * provider's email here would be a claim the app cannot always keep.
 */

type Contact = { type: string; name?: string | null; org?: string | null };

const ROLE_LABEL: Record<string, string> = {
  advisor: "Financial Advisor",
  sponsor: "Plan Sponsor",
  tpa: "Third Party Administrator",
};

/** Sponsor first — the signing order the e-sign roster uses. */
const ROLE_ORDER = ["advisor", "sponsor", "tpa"] as const;

export function PartiesBanner({ plan }: { plan?: { contacts?: Contact[] } | null }) {
  const contacts = plan?.contacts ?? [];
  if (contacts.length === 0) return null;

  const parties = ROLE_ORDER.flatMap((role) => {
    const c = contacts.find((x) => x.type === role);
    if (!c) return [];
    // A TPA is identified by its firm; the individual there is often unknown.
    const who = c.name || c.org;
    if (!who) return [];
    return [{ role, label: ROLE_LABEL[role] ?? role, who }];
  });

  if (parties.length === 0) return null;

  const signers = parties.filter((p) => p.role !== "tpa").length;

  return (
    <div className="parties-banner">
      <div className="parties-chips">
        {parties.map((p) => (
          <span className={`party-chip party-${p.role}`} key={p.role}>
            <span className="party-role">{p.label}:</span> {p.who}
          </span>
        ))}
      </div>
      <p className="parties-note">
        {signers > 1 ? "Both parties" : "This party"} will receive e-signature requests after
        submission.
      </p>
    </div>
  );
}
