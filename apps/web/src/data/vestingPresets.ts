import type { VestingStepInput } from "@vestara/shared";

type Row = { yearLabel: string; pct: number };
type ScheduleType = VestingStepInput["scheduleType"];

/**
 * Vesting ladders by schedule type, ported from the prototype's
 * `VEST_SCHEDULES`. Row index doubles as completed years of service, which is
 * the same convention `irsVestingFloor.ts` uses on the server to check the
 * §411(a)(2)(B) minimums — keep the two in step.
 *
 * `minPct` is display-only ("≥ 20%" hints in the table); the authoritative
 * check runs server-side on save.
 */
export const VEST_SCHEDULES: Record<ScheduleType, Array<Row & { minPct: number }>> = {
  imm: [{ yearLabel: "0+", pct: 100, minPct: 100 }],
  "3cliff": [
    { yearLabel: "Less than 1", pct: 0, minPct: 0 },
    { yearLabel: "1", pct: 0, minPct: 0 },
    { yearLabel: "2", pct: 0, minPct: 0 },
    { yearLabel: "3+", pct: 100, minPct: 100 },
  ],
  "6graded": [
    { yearLabel: "Less than 1", pct: 0, minPct: 0 },
    { yearLabel: "1", pct: 0, minPct: 0 },
    { yearLabel: "2", pct: 20, minPct: 20 },
    { yearLabel: "3", pct: 40, minPct: 40 },
    { yearLabel: "4", pct: 60, minPct: 60 },
    { yearLabel: "5", pct: 80, minPct: 80 },
    { yearLabel: "6+", pct: 100, minPct: 100 },
  ],
  custom: [
    { yearLabel: "Less than 1", pct: 0, minPct: 0 },
    { yearLabel: "1", pct: 20, minPct: 0 },
    { yearLabel: "2", pct: 40, minPct: 20 },
    { yearLabel: "3", pct: 60, minPct: 40 },
    { yearLabel: "4", pct: 80, minPct: 60 },
    { yearLabel: "5+", pct: 100, minPct: 80 },
  ],
};

/** Rows to persist for a schedule type — strips the display-only `minPct`. */
export const rowsForSchedule = (type: ScheduleType): Row[] =>
  VEST_SCHEDULES[type].map(({ yearLabel, pct }) => ({ yearLabel, pct }));
