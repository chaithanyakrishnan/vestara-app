import { useEffect, useRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import type { UseFormRegisterReturn, UseFormSetValue, FieldValues, Path } from "react-hook-form";
import { useMaskedField } from "../hooks/useMaskedField";
import {
  DOW_LABELS,
  MONTH_NAMES,
  formatDateInput,
  isValidDate,
  parseDate,
  toDateString,
} from "../lib/date";

type Mode = "cal" | "month" | "year";

type DateInputProps<T extends FieldValues> = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "onBlur" | "type" | "value"
> & {
  registration: UseFormRegisterReturn;
  /** RHF's setValue, so a calendar pick writes back through the form. */
  setValue: UseFormSetValue<T>;
  name: Path<T>;
  /** Current form value — drives which day renders as selected. */
  value?: string;
};

/**
 * Date field that auto-formats to MM/DD/YYYY as the user types and offers a
 * calendar popout, ported from the prototype's date picker (including its
 * month and year drill-down).
 *
 * Typing stays uncontrolled and masked via useMaskedField; the calendar writes
 * through RHF's setValue so both paths land in the same place.
 */
export function DateInput<T extends FieldValues>({
  registration,
  setValue,
  name,
  value,
  ...inputProps
}: DateInputProps<T>) {
  const { registrationRest, handlers, syncPrevious } = useMaskedField(registration, formatDateInput);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("cal");
  const wrapRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const parsed = value ? parseDate(value) : null;
  const [cursor, setCursor] = useState(() => ({
    year: parsed?.year ?? today.getFullYear(),
    month: parsed?.month ?? today.getMonth(),
  }));
  const [yearPage, setYearPage] = useState(() => Math.floor(cursor.year / 12) * 12);

  // Follow the typed value: once it becomes a real date, move the calendar to it.
  useEffect(() => {
    const p = value ? parseDate(value) : null;
    if (p) setCursor({ year: p.year, month: p.month });
  }, [value]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(year: number, month: number, day: number) {
    const next = toDateString(year, month, day);
    // shouldValidate so a previously-shown "required" error clears immediately.
    setValue(name, next as never, { shouldValidate: true, shouldDirty: true });
    syncPrevious(next);
    setOpen(false);
    setMode("cal");
  }

  function shiftMonth(delta: number) {
    setCursor((c) => {
      let month = c.month + delta;
      let year = c.year;
      if (month < 0) {
        month = 11;
        year--;
      }
      if (month > 11) {
        month = 0;
        year++;
      }
      return { year, month };
    });
  }

  const { year, month } = cursor;
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cellCount = Math.ceil((firstDow + daysInMonth) / 7) * 7;

  return (
    <div className="date-wrap" ref={wrapRef}>
      <input
        {...registrationRest}
        {...inputProps}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={inputProps.placeholder ?? "MM/DD/YYYY"}
        className={value && isValidDate(value) ? "has-value" : undefined}
        {...handlers}
      />
      <button
        type="button"
        className="date-icon"
        tabIndex={-1}
        aria-label="Open calendar"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div className="cal-popout" role="dialog" aria-label="Choose a date">
          {mode === "cal" && (
            <>
              <div className="cal-nav">
                <button type="button" className="cal-nav-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
                <button type="button" className="cal-month-label" onClick={() => setMode("month")}>
                  {MONTH_NAMES[month]} {year}
                </button>
                <button type="button" className="cal-nav-btn" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
              </div>
              <div className="cal-dow-row">
                {DOW_LABELS.map((d) => (
                  <div className="cal-dow" key={d}>{d}</div>
                ))}
              </div>
              <div className="cal-grid">
                {Array.from({ length: cellCount }, (_, i) => {
                  const inPrev = i < firstDow;
                  const inNext = i >= firstDow + daysInMonth;
                  const day = inPrev ? daysInPrev - firstDow + i + 1 : inNext ? i - firstDow - daysInMonth + 1 : i - firstDow + 1;
                  const isToday =
                    !inPrev && !inNext &&
                    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                  const isSelected =
                    !inPrev && !inNext &&
                    parsed?.year === year && parsed?.month === month && parsed?.day === day;
                  const classes = ["cal-day"];
                  if (inPrev || inNext) classes.push("other-month");
                  if (isToday) classes.push("today");
                  if (isSelected) classes.push("selected");
                  return (
                    <button
                      type="button"
                      key={i}
                      className={classes.join(" ")}
                      onClick={() => {
                        // Clicking a greyed-out cell jumps to that month, as the prototype did.
                        let y = year;
                        let m = month + (inPrev ? -1 : inNext ? 1 : 0);
                        if (m < 0) { m = 11; y--; }
                        if (m > 11) { m = 0; y++; }
                        pick(y, m, day);
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {mode === "month" && (
            <>
              <div className="cal-nav">
                <button type="button" className="cal-nav-btn" onClick={() => setCursor((c) => ({ ...c, year: c.year - 1 }))} aria-label="Previous year">‹</button>
                <button type="button" className="cal-month-label" onClick={() => { setYearPage(Math.floor(year / 12) * 12); setMode("year"); }}>
                  {year}
                </button>
                <button type="button" className="cal-nav-btn" onClick={() => setCursor((c) => ({ ...c, year: c.year + 1 }))} aria-label="Next year">›</button>
              </div>
              <div className="cal-picker-grid">
                {MONTH_NAMES.map((m, i) => (
                  <button
                    type="button"
                    key={m}
                    className={`cal-picker-item${i === month ? " sel" : ""}`}
                    onClick={() => { setCursor((c) => ({ ...c, month: i })); setMode("cal"); }}
                  >
                    {m.slice(0, 3)}
                  </button>
                ))}
              </div>
            </>
          )}

          {mode === "year" && (
            <>
              <div className="cal-nav">
                <button type="button" className="cal-nav-btn" onClick={() => setYearPage((p) => p - 12)} aria-label="Earlier years">‹</button>
                <span className="cal-month-label">{yearPage}–{yearPage + 11}</span>
                <button type="button" className="cal-nav-btn" onClick={() => setYearPage((p) => p + 12)} aria-label="Later years">›</button>
              </div>
              <div className="cal-picker-grid">
                {Array.from({ length: 12 }, (_, i) => yearPage + i).map((y) => (
                  <button
                    type="button"
                    key={y}
                    className={`cal-picker-item${y === year ? " sel" : ""}`}
                    onClick={() => { setCursor((c) => ({ ...c, year: y })); setMode("month"); }}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
