import type { ReactNode } from "react";

/**
 * The prototype's selectable cards, used in place of dropdowns wherever the
 * choice deserves an explanation (safe harbor formulas, vesting ladders, plan
 * expense payer) and in place of bare checkboxes for multi-select sets.
 *
 * Rendered as real <button type="button"> elements so they are keyboard
 * reachable and don't submit the surrounding form.
 */

export function OptionGrid({
  cols = 2,
  children,
}: {
  cols?: 1 | 2 | 3;
  children: ReactNode;
}) {
  return <div className={`option-grid${cols > 1 ? ` cols-${cols}` : ""}`}>{children}</div>;
}

interface OptionCardProps {
  title: ReactNode;
  desc?: ReactNode;
  /** Monospace formula line, e.g. "100% on first 3% + 50% on next 2%". */
  formula?: ReactNode;
  selected: boolean;
  onSelect: () => void;
  /** Renders a tick box on the right — use for multi-select sets. */
  checkable?: boolean;
}

export function OptionCard({ title, desc, formula, selected, onSelect, checkable }: OptionCardProps) {
  const body = (
    <>
      <div className="opt-title">{title}</div>
      {desc && <div className="opt-desc">{desc}</div>}
      {formula && <div className="opt-formula">{formula}</div>}
    </>
  );

  return (
    <button
      type="button"
      className={`opt-card${checkable ? " checkable" : ""}${selected ? " selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      {checkable ? (
        <>
          <div className="opt-body">{body}</div>
          <span className="opt-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
        </>
      ) : (
        body
      )}
    </button>
  );
}
