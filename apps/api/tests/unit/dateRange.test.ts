import { describe, it, expect } from "vitest";
import {
  doDateRangesOverlap,
  isValidDateString,
  formatPostgresDateRange,
} from "../../src/shared/utils/dateRange.js";

describe("Date Range Utilities", () => {
  it("detects overlapping date ranges correctly", () => {
    const range1Start = new Date("2026-06-01");
    const range1End = new Date("2026-06-05");

    // Overlapping: inside
    expect(
      doDateRangesOverlap(
        range1Start,
        range1End,
        new Date("2026-06-02"),
        new Date("2026-06-04"),
      ),
    ).toBe(true);

    // Overlapping: starts earlier, ends inside
    expect(
      doDateRangesOverlap(
        range1Start,
        range1End,
        new Date("2026-05-30"),
        new Date("2026-06-02"),
      ),
    ).toBe(true);

    // Overlapping: starts inside, ends after
    expect(
      doDateRangesOverlap(
        range1Start,
        range1End,
        new Date("2026-06-04"),
        new Date("2026-06-08"),
      ),
    ).toBe(true);

    // Adjacent / back-to-back: hotel check-out day = next check-in day -> Should NOT overlap ([start, end))
    expect(
      doDateRangesOverlap(
        range1Start,
        range1End,
        new Date("2026-06-05"),
        new Date("2026-06-08"),
      ),
    ).toBe(false);

    expect(
      doDateRangesOverlap(
        range1Start,
        range1End,
        new Date("2026-05-25"),
        new Date("2026-06-01"),
      ),
    ).toBe(false);
  });

  it("validates date strings", () => {
    expect(isValidDateString("2026-11-10")).toBe(true);
    expect(isValidDateString("2026-11-10T12:00:00Z")).toBe(true);
    expect(isValidDateString("invalid-date")).toBe(false);
  });

  it("formats postgres date ranges", () => {
    const formatted = formatPostgresDateRange("2026-06-01", "2026-06-05");
    expect(formatted).toBe("[2026-06-01, 2026-06-05)");
  });
});
