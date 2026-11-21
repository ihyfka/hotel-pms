export function doDateRangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA < endB && endA > startB;
}

export function isValidDateString(dateStr: string): boolean {
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

export function formatPostgresDateRange(
  start: Date | string,
  end: Date | string,
): string {
  const s = typeof start === "string" ? start : start.toISOString();
  const e = typeof end === "string" ? end : end.toISOString();
  return `[${s}, ${e})`;
}
