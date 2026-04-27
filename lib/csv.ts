// Minimal RFC 4180 CSV writer. Wraps cells in double quotes when they
// contain commas, quotes, or newlines; escapes inner quotes by doubling.

export type CsvCell = string | number | bigint | boolean | null | undefined;

export function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv<T extends Record<string, CsvCell>>(args: {
  headers: ReadonlyArray<keyof T & string>;
  rows: T[];
}): string {
  const { headers, rows } = args;
  const headerLine = headers.map(escapeCsvCell).join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCsvCell(row[h])).join(","),
  );
  // Use CRLF per RFC 4180 — Excel and most spreadsheet apps prefer it.
  return [headerLine, ...dataLines].join("\r\n");
}
