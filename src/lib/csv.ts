/**
 * RFC-4180 CSV serialiser shared by every staff report.
 *
 * Kept free of server-only imports so the same function can run in a client
 * component to build the downloadable blob. Numbers, booleans, dates and nulls
 * are normalised to plain strings; every field that contains a delimiter, a
 * double quote or a line break is wrapped in quotes and any inner quote is
 * doubled — the escaping Excel and Google Sheets expect.
 */

export const CSV_BOM = "\uFEFF";

export interface CsvColumn<T = Record<string, unknown>> {
  /** Property read from each row object. */
  key: keyof T & string;
  /** Human-readable header written on the first line. */
  label: string;
  /** Optional cell formatter; receives the raw value and the whole row. */
  format?: (value: unknown, row: T) => string;
}

export type CsvRow = Record<string, unknown>;

/** Escapes and quotes a single cell per RFC-4180. */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();

  const text =
    typeof value === "object" ? JSON.stringify(value) : Array.isArray(value) ? value.join("; ") : String(value);

  // Guard against formula injection in spreadsheet clients.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;

  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/** Renders a single CSV line from already-escaped cells. */
function joinRow(cells: string[]): string {
  return cells.join(",");
}

/**
 * Builds a CSV document from a header row and an already-stringified matrix.
 * Used by the reports pages: the server formats each cell to a plain string so
 * the finished table can cross the server/client boundary, then the download
 * button rebuilds the exact same document from those strings.
 */
export function toCsvMatrix(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [joinRow(headers.map(escapeCsvValue))];
  for (const row of rows) {
    lines.push(joinRow(row.map(escapeCsvValue)));
  }
  return CSV_BOM + lines.join("\r\n");
}

/** A serialisable report payload safe to pass from a Server Component to the client. */
export interface CsvMatrixReport {
  filename: string;
  headers: string[];
  rows: string[][];
}

/** Escapes a matrix report into a downloadable CSV document. */
export function reportToCsv(report: CsvMatrixReport): string {
  return toCsvMatrix(report.headers, report.rows);
}

/**
 * Builds a complete CSV document (headers + rows) with a UTF-8 BOM so Excel on
 * Windows opens Philippine Peso signs and Filipino names correctly.
 */
export function toCsv<T extends CsvRow>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const header = joinRow(columns.map((column) => escapeCsvValue(column.label)));
  const lines = [header];

  for (const row of rows) {
    const cells = columns.map((column) =>
      escapeCsvValue(column.format ? column.format(row[column.key], row) : row[column.key]),
    );
    lines.push(joinRow(cells));
  }

  return CSV_BOM + lines.join("\r\n");
}

/** Convenience: turn ISO timestamps into a locale-friendly `YYYY-MM-DD HH:mm`. */
export function formatCsvDateTime(value: unknown): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

/** `true`/`false` cells rendered as yes/no for readability. */
export function formatCsvBoolean(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  return value ? "yes" : "no";
}

/** Numeric cells rendered with two decimals for money columns. */
export function formatCsvMoney(value: unknown): string {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toFixed(2) : "";
}

/** Filename helper producing a stable, download-safe slug with a date stamp. */
export function csvFileName(prefix: string, date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  return `${prefix}-${stamp}.csv`;
}
