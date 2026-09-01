import { useRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { useMaskedField } from "../hooks/useMaskedField";
import { searchCompanies, formatCompanyAddress, type Company } from "../data/companies";

/** Progressive: "45" → "45", "450431167" → "45-0431167". Capped at 9 digits. */
export function formatEin(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

type EinInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "onBlur" | "type"> & {
  registration: UseFormRegisterReturn;
  /** Called when a company is picked, so the parent can fill the dependent fields. */
  onSelectCompany?: (company: Company) => void;
};

/**
 * EIN field: auto-formats to XX-XXXXXXX as the user types (matching the
 * `einRegex` in IdentityStepSchema and the field's own hint), and offers the
 * prototype's company lookup — type digits OR a company name.
 *
 * Search runs on the raw text before masking, so typing "4 Bears" still
 * matches even though only digits survive into the field's value.
 */
export function EinInput({ registration, onSelectCompany, ...inputProps }: EinInputProps) {
  const { registrationRest, handlers, syncPrevious } = useMaskedField(registration, formatEin);
  const [matches, setMatches] = useState<Company[]>([]);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Suppresses the list for one blur cycle when a pick is in flight, so
  // mousedown on an item isn't cancelled by the input's blur.
  const pickingRef = useRef(false);

  function runSearch(text: string) {
    setQuery(text);
    setMatches(searchCompanies(text));
  }

  function choose(company: Company) {
    const input = inputRef.current;
    if (input) {
      input.value = company.ein;
      syncPrevious(company.ein);
      // Notify RHF through a native input event so the registration records it.
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setMatches([]);
    setQuery("");
    onSelectCompany?.(company);
  }

  return (
    <div className="ac-wrap">
      <input
        {...registrationRest}
        {...inputProps}
        ref={(el) => {
          registrationRest.ref(el);
          inputRef.current = el;
        }}
        type="text"
        inputMode="text"
        autoComplete="off"
        className="mono"
        placeholder={inputProps.placeholder ?? "XX-XXXXXXX"}
        onChange={(e) => {
          // Capture what was typed BEFORE the mask strips non-digits, so a name
          // search still works.
          runSearch(e.target.value);
          handlers.onChange(e);
        }}
        onFocus={(e) => {
          handlers.onFocus(e);
          if (query) setMatches(searchCompanies(query));
        }}
        onBlur={(e) => {
          handlers.onBlur(e);
          if (!pickingRef.current) setMatches([]);
        }}
      />
      {matches.length > 0 && (
        <ul className="ac-list">
          {matches.map((c) => (
            <li
              key={c.ein}
              className="ac-item"
              onMouseDown={() => {
                pickingRef.current = true;
              }}
              onClick={() => {
                choose(c);
                pickingRef.current = false;
              }}
            >
              {c.name}
              <span>
                {c.ein} · {c.city}, {c.state}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { formatCompanyAddress };
