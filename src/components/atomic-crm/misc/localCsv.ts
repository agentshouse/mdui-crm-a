import { Parser } from "@/vendor/papa-local.js";
import type { ImportRow } from "../dataImport/types";
export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 5000;
/** Only text enters the retained Papa core. No URL, download, worker or stream API. */
export function parseLocalCsv(text: string): ImportRow[] {
  const source = text.replace(/^\ufeff/, "");
  if (!source.trim()) throw new Error("The CSV file is empty.");
  const newline = source.match(/\r\n|\n|\r/)?.[0] ?? "\n";
  const delimiter = [",", ";", "\t", "|"]
    .map((delimiter) => {
      const result = new Parser({ delimiter, newline, preview: 10 }).parse(
        source,
      );
      const rows = result.data.filter((row) => row.some((cell) => cell.trim()));
      const width = rows[0]?.length ?? 0;
      const consistent = rows.filter((row) => row.length === width).length;
      return {
        delimiter,
        score: width > 1 ? consistent * 100 + Math.min(width, 99) : 0,
      };
    })
    .sort((a, b) => b.score - a.score)[0].delimiter;
  const result = new Parser({ delimiter, newline }).parse(source);
  if (result.errors.length)
    throw new Error(`CSV parsing failed: ${result.errors[0].message}`);
  const [rawHeaders, ...rawRows] = result.data.filter((row) =>
    row.some((cell) => cell.trim()),
  );
  const headers = rawHeaders.map((header) => header.trim());
  if (
    headers.some(
      (header) =>
        !header || ["__proto__", "constructor", "prototype"].includes(header),
    )
  )
    throw new Error("CSV headers must be nonempty supported column names.");
  if (new Set(headers).size !== headers.length)
    throw new Error("CSV has duplicate column headers.");
  if (!rawRows.length) throw new Error("The CSV has headers but no data rows.");
  if (rawRows.length > MAX_CSV_ROWS)
    throw new Error(`Import at most ${MAX_CSV_ROWS} rows at a time.`);
  return rawRows.map((values, index) => {
    if (values.length !== headers.length)
      throw new Error(
        `CSV row ${index + 2} has ${values.length} cells; expected ${headers.length}. No rows were imported.`,
      );
    // Keep every cell as text: leading zeroes survive, and mappings explicitly
    // interpret only their numeric/boolean/date columns. Formulas are inert text.
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
  });
}
