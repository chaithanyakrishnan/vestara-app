import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * The prototype's toggle switch row plus its animated reveal, used for the
 * elect-then-configure blocks (safe harbor, nonelective, loans, hardship,
 * rollovers, auto-enrollment).
 */

interface ToggleRowProps {
  label: ReactNode;
  sub?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
}

export function ToggleRow({ label, sub, checked, onChange }: ToggleRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle-row${checked ? " on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-info">
        <span className="toggle-label">{label}</span>
        {sub && <span className="toggle-sub" style={{ display: "block" }}>{sub}</span>}
      </span>
      <span className="toggle-switch" aria-hidden="true" />
    </button>
  );
}

/**
 * Max-height reveal. Once the open transition finishes it switches to
 * `overflow: visible` so calendar popouts and autocomplete lists inside can
 * escape the clipping box — otherwise a date picker in a revealed block would
 * be cut off at the container edge.
 */
export function RevealSection({ open, children }: { open: boolean; children: ReactNode }) {
  const [settled, setSettled] = useState(open);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (open) {
      timer.current = setTimeout(() => setSettled(true), 360); // just past the 0.35s transition
    } else {
      setSettled(false);
    }
    return () => clearTimeout(timer.current);
  }, [open]);

  return (
    <div
      className={`reveal-section${open ? " open" : ""}${open && settled ? " settled" : ""}`}
      aria-hidden={!open}
    >
      {children}
    </div>
  );
}
