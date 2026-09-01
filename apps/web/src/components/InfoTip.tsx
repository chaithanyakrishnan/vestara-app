import { useEffect, useId, useRef, useState } from "react";
import { sectionHelp } from "@vestara/shared";

/**
 * The "what is this?" marker beside a plan election's label.
 *
 * Built as a real <button> rather than a hover-only <span> on purpose: an
 * explanation reachable only with a mouse is invisible to keyboard and screen
 * reader users, and these tooltips carry the compliance meaning of the field.
 * It opens on hover AND focus, closes on Escape or an outside click, and is
 * wired to the label through aria-describedby.
 */
export function InfoTip({ text, label }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <span
      className="infotip"
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="infotip-trigger"
        aria-label={label ? `What is ${label}?` : "More information"}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        // Tapping is the only way to reach this on a touch screen, where there
        // is no hover at all.
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
      >
        i
      </button>
      <span className="infotip-bubble" id={id} role="tooltip" hidden={!open}>
        {text}
      </span>
    </span>
  );
}

/**
 * The same marker for a SECTION heading, which labels a group of choices rather
 * than one input. Renders nothing when the heading has no entry in SECTION_HELP,
 * so adding a heading never requires touching this.
 */
export function SectionTip({ heading }: { heading: string }) {
  const text = sectionHelp(heading);
  if (!text) return null;
  return <InfoTip text={text} label={heading} />;
}
