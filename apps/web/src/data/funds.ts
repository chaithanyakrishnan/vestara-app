/**
 * Core + target-date fund universe backing the Trustees & Funds lineup picker,
 * ported from the prototype's `FUNDS` / `TD_FUNDS`.
 *
 * `TrusteesFundsStepSchema.selectedFundTickers` is a plain `string[]` with a
 * min-3 rule — it does NOT validate tickers against this list — so this is
 * presentation data only and lives in the web app rather than @vestara/shared.
 */
export interface Fund {
  ticker: string;
  name: string;
  type: string;
}

export const FUNDS: Fund[] = [
  { ticker: "VTSAX", name: "Vanguard Total Stock Market Index", type: "US Equity" },
  { ticker: "VTIAX", name: "Vanguard Total Intl Stock Index", type: "Intl Equity" },
  { ticker: "VBTLX", name: "Vanguard Total Bond Market Index", type: "Fixed Income" },
  { ticker: "TRBCX", name: "T. Rowe Price Blue Chip Growth", type: "Large Cap Growth" },
  { ticker: "PTTRX", name: "PIMCO Total Return", type: "Core Plus Bond" },
  { ticker: "VMFXX", name: "Vanguard Federal Money Market", type: "Stable Value" },
  { ticker: "VGSIX", name: "Vanguard Real Estate Index", type: "Real Assets" },
];

export const TD_FUNDS: Fund[] = [
  { ticker: "VTTVX", name: "Vanguard Target 2025", type: "Target Date" },
  { ticker: "VTHRX", name: "Vanguard Target 2030", type: "Target Date" },
  { ticker: "VTTHX", name: "Vanguard Target 2035", type: "Target Date" },
  { ticker: "VFORX", name: "Vanguard Target 2040", type: "Target Date" },
  { ticker: "VTIVX", name: "Vanguard Target 2045", type: "Target Date" },
  { ticker: "VFIFX", name: "Vanguard Target 2050", type: "Target Date" },
];

export const ALL_FUNDS: Fund[] = [...FUNDS, ...TD_FUNDS];

/** ERISA Section 404(c) safe harbor requires at least three diversified core options. */
export const MIN_CORE_FUNDS = 3;

export const fundByTicker = (ticker: string) => ALL_FUNDS.find((f) => f.ticker === ticker);
