/** Display formatting for OData primitive values. Never throws on missing/odd input. */

/** Edm.Date ("YYYY-MM-DD...") -> locale date string. null/undefined/"" -> "–". */
export function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === "") return "–";
  const str = String(value);
  // Parse the date parts manually (rather than `new Date(str)`) so a bare "YYYY-MM-DD"
  // is treated as a local calendar date, not UTC midnight — avoids an off-by-one-day
  // shift in timezones behind UTC.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(str);
  if (Number.isNaN(date.getTime())) return str;
  return date.toLocaleDateString();
}

/** Edm.Decimal (number or string, per OData V4 JSON) -> fixed 2-decimal number. "–" on empty. */
export function formatDecimal(value: unknown): string {
  if (value === null || value === undefined || value === "") return "–";
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toFixed(2);
}

/** null/undefined/"" -> "–"; otherwise the plain string form. */
export function formatText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "–";
  return String(value);
}

/** Dispatches on an Edm type name (as reported by the ServiceModel's PropertyModel/ColumnModel). */
export function formatValue(value: unknown, type: string | undefined): string {
  if (value === null || value === undefined || value === "") return "–";
  if (type === "Edm.Date" || type === "Edm.DateTimeOffset") return formatDate(value);
  if (type === "Edm.Decimal" || type === "Edm.Double" || type === "Edm.Single") {
    return formatDecimal(value);
  }
  return formatText(value);
}
