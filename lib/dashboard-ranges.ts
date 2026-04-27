// Pre-set window options for the dashboard range picker. Plain module
// (no "use client") so both the Server Component dashboard page and the
// Client Component picker can import the same source of truth.

export type RangeOption = {
  value: string;
  days: number;
  label: string;
};

export const RANGE_OPTIONS: readonly RangeOption[] = [
  { value: "7", days: 7, label: "7 hari terakhir" },
  { value: "14", days: 14, label: "14 hari terakhir" },
  { value: "30", days: 30, label: "30 hari terakhir" },
  { value: "60", days: 60, label: "60 hari terakhir" },
  { value: "90", days: 90, label: "90 hari terakhir" },
] as const;

export const RANGE_VALUES: readonly number[] = RANGE_OPTIONS.map((r) => r.days);

export const DEFAULT_DAYS = 30;

export function parseDaysParam(raw: string | undefined | null): number {
  const n = Number(raw);
  return RANGE_VALUES.includes(n) ? n : DEFAULT_DAYS;
}
