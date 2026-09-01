import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlans, useDeletePlan } from "../hooks/usePlans";
import { useAuthStore } from "../lib/authStore";
import { ApiClientError } from "../lib/apiClient";

/**
 * Plan submissions dashboard.
 *
 * Every column is derived from data the API already stores. The API returns a
 * `summary` per plan (see plans.service.toPlanSummary) rather than raw step
 * JSON — the row needs fields from three different steps, and `administration`
 * holds bank credentials that have no business in a list response.
 *
 * There is deliberately no e-signature-vendor column: signing in this app is
 * the typed signature captured on the Review screen, so "Signature" reports
 * `signatureName` / `submittedAt` rather than an integration that does not
 * exist yet.
 */

const PLAN_TYPE_LABEL: Record<string, string> = {
  "401k": "401(k)",
  "403b": "403(b)",
  "457b_gov": "457(b) Gov",
  "457b_nongov": "457(b) Non-gov",
  "401a": "401(a)",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  review: "In review",
  submitted: "Submitted",
};

const QDIA_LABEL: Record<string, string> = {
  target: "Target-date QDIA",
  balanced: "Balanced QDIA",
  managed: "Managed account",
};

const PAY_METHOD_LABEL: Record<string, string> = { ach: "ACH", check: "Check", wire: "Wire" };

const SIG_LABEL: Record<string, string> = {
  pending: "Awaiting send",
  sent: "Out for signature",
  signed: "Executed",
};

type SortKey = "plan" | "type" | "sponsor" | "advisor" | "compliance" | "submitted";

interface Row {
  plan: any;
  s: any;
  planName: string;
  sponsorName: string | null;
  sponsorOrg: string | null;
  advisorName: string | null;
  advisorFirm: string | null;
  /** submittedAt when signed, otherwise last touch — what the date column sorts on. */
  activityAt: number;
  haystack: string;
}

function toRow(plan: any): Row {
  const s = plan.summary ?? {};
  const sponsor = plan.contacts?.find((c: any) => c.type === "sponsor");
  const advisor = plan.contacts?.find((c: any) => c.type === "advisor");
  const tpa = plan.contacts?.find((c: any) => c.type === "tpa");
  // A draft that hasn't reached the identity step has no plan name yet — fall
  // back to the sponsor org captured on the contact gate.
  const planName = s.planName || sponsor?.org || "Untitled plan";

  return {
    plan,
    s,
    planName,
    sponsorName: sponsor?.name ?? null,
    sponsorOrg: sponsor?.org ?? null,
    advisorName: advisor?.name ?? null,
    advisorFirm: advisor?.org ?? null,
    activityAt: new Date(plan.submittedAt ?? plan.updatedAt ?? plan.createdAt).getTime(),
    haystack: [
      planName,
      s.employerName,
      s.employerEin,
      s.planNumber,
      s.payrollProvider,
      sponsor?.name,
      sponsor?.org,
      sponsor?.email,
      advisor?.name,
      advisor?.org,
      advisor?.email,
      // A TPA has no column of its own, but people look plans up by which TPA
      // is on them, so it stays searchable.
      tpa?.org,
      tpa?.name,
      tpa?.email,
      plan.refNumber,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

const dateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export function DashboardPage() {
  const { data: plans, isLoading, isFetching, refetch, dataUpdatedAt } = usePlans();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [newTransferFilter, setNewTransferFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "submitted", dir: -1 });

  // Two-step confirm held in place in the row rather than a window.confirm or a
  // modal: deleting a plan is irreversible, but it is also routine housekeeping
  // on abandoned drafts, so the confirmation should not leave the list.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deletePlan = useDeletePlan();

  const rows = useMemo(() => (plans ?? []).map(toRow), [plans]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      newPlans: rows.filter((r) => r.s.planStatus !== "transfer").length,
      transfers: rows.filter((r) => r.s.planStatus === "transfer").length,
      // Executed = every party has e-signed. A draft counts as neither: it has
      // not been sent for signature at all.
      signed: rows.filter((r) => r.s.signatureStatus === "signed").length,
      pending: rows.filter((r) => r.plan.status !== "draft" && r.s.signatureStatus !== "signed").length,
    }),
    [rows],
  );

  // One chip per plan type actually present, doubling as a filter toggle —
  // clicking a chip is the same as picking it in the plan-type select.
  const typeChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) if (r.s.planType) counts.set(r.s.planType, (counts.get(r.s.planType) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (q && !r.haystack.includes(q)) return false;
      if (typeFilter !== "all" && r.s.planType !== typeFilter) return false;
      if (newTransferFilter !== "all" && (r.s.planStatus ?? "new") !== newTransferFilter) return false;
      if (statusFilter !== "all" && r.plan.status !== statusFilter) return false;
      return true;
    });

    const cmp = (a: Row, b: Row) => {
      switch (sort.key) {
        case "plan":
          return a.planName.localeCompare(b.planName);
        case "type":
          return (a.s.planType ?? "").localeCompare(b.s.planType ?? "");
        case "sponsor":
          return (a.sponsorOrg ?? a.sponsorName ?? "").localeCompare(b.sponsorOrg ?? b.sponsorName ?? "");
        case "advisor":
          return (a.advisorName ?? "").localeCompare(b.advisorName ?? "");
        case "compliance":
          return (a.s.compliancePct ?? 0) - (b.s.compliancePct ?? 0);
        case "submitted":
          return a.activityAt - b.activityAt;
      }
    };
    return [...filtered].sort((a, b) => cmp(a, b) * sort.dir);
  }, [rows, search, typeFilter, newTransferFilter, statusFilter, sort]);

  const filtersActive =
    search.trim() !== "" || typeFilter !== "all" || newTransferFilter !== "all" || statusFilter !== "all";

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  function handleDelete(planId: string) {
    setError(null);
    deletePlan.mutate(planId, {
      onSuccess: () => setConfirmingId(null),
      onError: (err) => {
        // A submitted plan answers 409 — the button is hidden for those, but a
        // stale list could still get here.
        setError(err instanceof ApiClientError ? err.message : "Could not delete the plan");
        setConfirmingId(null);
      },
    });
  }

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setNewTransferFilter("all");
    setStatusFilter("all");
  }

  const SortHead = ({ label, sortKey }: { label: string; sortKey: SortKey }) => (
    <th>
      <button className="th-sort" onClick={() => toggleSort(sortKey)}>
        {label}
        <span className="th-arrow">{sort.key === sortKey ? (sort.dir === 1 ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );

  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <div className="panel-eyebrow">{user?.role.toUpperCase()}</div>
          <div className="dash-title">Plan submissions dashboard</div>
          <div className="dash-sub">
            {dataUpdatedAt ? `Last updated ${timeFmt.format(dataUpdatedAt)} · ` : ""}
            {stats.total} total {stats.total === 1 ? "submission" : "submissions"}
          </div>
        </div>
        <div className="dash-head-actions">
          <button className="btn-back" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing…" : "↻ Refresh"}
          </button>
          <button className="btn-back" onClick={() => { clearSession(); navigate("/login"); }}>
            Sign out
          </button>
          <button className="btn-primary" onClick={() => navigate("/onboarding/new")}>
            + New onboarding
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{stats.total}</div>
          <div className="stat-label">Total plans</div>
        </div>
        <div className="stat-card">
          <div className="stat-num green">{stats.newPlans}</div>
          <div className="stat-label">New plans</div>
        </div>
        <div className="stat-card">
          <div className="stat-num amber">{stats.transfers}</div>
          <div className="stat-label">Transfers</div>
        </div>
        <div className="stat-card">
          <div className="stat-num teal">{stats.signed}</div>
          <div className="stat-label">Signed</div>
        </div>
        <div className="stat-card">
          <div className="stat-num red">{stats.pending}</div>
          <div className="stat-label">Pending signature</div>
        </div>
      </div>

      {typeChips.length > 0 && (
        <div className="type-chips">
          {typeChips.map(([type, count]) => (
            <button
              key={type}
              className={`type-chip${typeFilter === type ? " active" : ""}`}
              onClick={() => setTypeFilter(typeFilter === type ? "all" : type)}
            >
              {PLAN_TYPE_LABEL[type] ?? type} <span className="type-chip-count">{count}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="inline-alert error" style={{ marginBottom: 16 }}>
          <span>{error}</span>
        </div>
      )}

      <div className="dash-filters">
        <div className="field dash-search">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="4.5" stroke="#6E7A72" strokeWidth="1.5" />
            <path d="M9.5 9.5L13 13" stroke="#6E7A72" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plan name, EIN, sponsor, advisor…"
            aria-label="Search plans"
          />
        </div>
        <div className="field">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by plan type">
            <option value="all">All plan types</option>
            {Object.entries(PLAN_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <select
            value={newTransferFilter}
            onChange={(e) => setNewTransferFilter(e.target.value)}
            aria-label="Filter by new or transfer"
          >
            <option value="all">New &amp; transfer</option>
            <option value="new">New plans only</option>
            <option value="transfer">Transfers only</option>
          </select>
        </div>
        <div className="field">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="review">In review</option>
            <option value="submitted">Submitted</option>
          </select>
        </div>
      </div>

      <div className="plan-table-wrap">
        {isLoading && <div className="dash-empty">Loading…</div>}

        {!isLoading && rows.length === 0 && (
          <div className="dash-empty">
            <div className="dash-empty-icon">📭</div>
            <div className="dash-empty-title">No submissions yet</div>
            <div>
              Click <strong>New onboarding</strong> to start a plan.
            </div>
          </div>
        )}

        {!isLoading && rows.length > 0 && visible.length === 0 && (
          <div className="dash-empty">
            <div className="dash-empty-icon">🔍</div>
            <div className="dash-empty-title">No plans match these filters</div>
            <div>
              <button className="link-button" onClick={clearFilters}>
                Clear all filters
              </button>
            </div>
          </div>
        )}

        {visible.length > 0 && (
          <table className="plan-table">
            <thead>
              <tr>
                <SortHead label="Plan" sortKey="plan" />
                <SortHead label="Type" sortKey="type" />
                <SortHead label="Sponsor" sortKey="sponsor" />
                <SortHead label="Advisor" sortKey="advisor" />
                <SortHead label="Compliance" sortKey="compliance" />
                <th>Investments</th>
                <th>Payroll</th>
                <th>Fee method</th>
                <th>Signature</th>
                <SortHead label="Submitted" sortKey="submitted" />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const p = r.plan;
                const s = r.s;
                const confirming = confirmingId === p.id;
                const busy = deletePlan.isPending && confirming;
                const pct = s.compliancePct ?? 0;
                const open = () => navigate(`/onboarding/${p.id}/step/identity`);
                return (
                  <tr key={p.id} onClick={open}>
                    <td>
                      <div className="plan-name">{r.planName}</div>
                      <div className="plan-org">
                        {s.employerEin ? `EIN ${s.employerEin}` : "EIN not set"}
                        {s.planNumber ? ` · #${s.planNumber}` : ""}
                      </div>
                      {s.employerName && s.employerName !== r.planName && (
                        <div className="plan-org">{s.employerName}</div>
                      )}
                    </td>
                    <td>
                      {s.planType ? (
                        <span className="type-tag">{PLAN_TYPE_LABEL[s.planType] ?? s.planType}</span>
                      ) : (
                        <span className="cell-sub">—</span>
                      )}
                      <div className="cell-sub" style={{ marginTop: 4 }}>
                        {s.planStatus === "transfer" ? "Transfer" : "New plan"}
                      </div>
                    </td>
                    <td>
                      <div>{r.sponsorOrg ?? r.sponsorName ?? "—"}</div>
                      {r.sponsorOrg && r.sponsorName && <div className="cell-sub">{r.sponsorName}</div>}
                    </td>
                    <td>
                      <div>{r.advisorName ?? "—"}</div>
                      {r.advisorFirm && <div className="cell-sub">{r.advisorFirm}</div>}
                    </td>
                    {/* Compliance = steps that re-validate against their schema,
                        the same check the server runs at submit. Not "rows
                        exist" — a partial AI prefill would score as done. */}
                    <td>
                      <div className="row-progress">
                        <div className={`compliance-pct${pct === 100 ? " full" : ""}`}>{pct}%</div>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="cell-sub">
                          {s.completedSteps ?? 0} of {s.totalSteps ?? 6} steps
                          {s.documentCount > 0 && ` · ${s.documentCount} doc${s.documentCount > 1 ? "s" : ""}`}
                        </div>
                      </div>
                    </td>
                    <td>
                      {s.fundCount ? (
                        <>
                          <div>
                            {s.fundCount} fund{s.fundCount === 1 ? "" : "s"}
                          </div>
                          <div className="cell-sub">{QDIA_LABEL[s.qdia] ?? "No QDIA"}</div>
                        </>
                      ) : (
                        <span className="cell-sub">Not selected</span>
                      )}
                    </td>
                    <td>
                      {s.payrollProvider ? (
                        <div>{s.payrollProvider}</div>
                      ) : (
                        <span className="cell-sub">Not set</span>
                      )}
                    </td>
                    <td>
                      {s.planExpensePayer === "plan" && <div>Plan pays</div>}
                      {s.planExpensePayer === "employer" && (
                        <>
                          <div>Employer pays</div>
                          <div className="cell-sub">{PAY_METHOD_LABEL[s.employerPaymentMethod] ?? "Method TBD"}</div>
                        </>
                      )}
                      {!s.planExpensePayer && <span className="cell-sub">Not set</span>}
                    </td>
                    <td>
                      {s.signatureStatus && s.signatureStatus !== "none" ? (
                        <>
                          <span className={`pill sig-${s.signatureStatus}`}>
                            {SIG_LABEL[s.signatureStatus] ?? s.signatureStatus}
                          </span>
                          <div className="cell-sub" style={{ marginTop: 4 }}>
                            {s.signaturesSigned} of {s.signaturesTotal} signed
                          </div>
                        </>
                      ) : (
                        <span className={`pill ${p.status}`}>{STATUS_LABEL[p.status] ?? p.status}</span>
                      )}
                    </td>
                    <td>
                      {p.submittedAt ? (
                        <div>{dateFmt.format(new Date(p.submittedAt))}</div>
                      ) : (
                        <span className="cell-sub">—</span>
                      )}
                      <div className="mono-cell">{p.refNumber}</div>
                    </td>
                    {/* Only drafts are deletable. Submitted plans carry a
                        signature and a timestamp — the API refuses those too. */}
                    <td style={{ whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                      {confirming ? (
                        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <button className="row-action confirm" disabled={busy} onClick={() => handleDelete(p.id)}>
                            {busy ? "Deleting…" : "Confirm"}
                          </button>
                          <button className="row-action" disabled={busy} onClick={() => setConfirmingId(null)}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <button className="row-action neutral" onClick={open}>
                            View
                          </button>
                          {p.status === "draft" && (
                            <button
                              className="row-action"
                              aria-label={`Delete draft plan ${r.planName}`}
                              onClick={() => {
                                setError(null);
                                setConfirmingId(p.id);
                              }}
                            >
                              Del
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {visible.length > 0 && filtersActive && (
        <div className="dash-sub" style={{ marginTop: 12 }}>
          Showing {visible.length} of {rows.length} plans ·{" "}
          <button className="link-button" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
