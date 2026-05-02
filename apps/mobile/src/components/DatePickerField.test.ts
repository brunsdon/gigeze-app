import { describe, expect, it } from "vitest";
import { formatDatePickerValue, getCalendarMonthGrid, parseDatePickerValue } from "./DatePickerField.helpers";

describe("DatePickerField helpers", () => {
  it("formats and parses date-only values without timezone drift", () => {
    const date = parseDatePickerValue("2026-04-20");

    expect(date).toBeInstanceOf(Date);
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(3);
    expect(date?.getDate()).toBe(20);
    expect(formatDatePickerValue(date as Date)).toBe("2026-04-20");
  });

  it("rejects invalid date-only values", () => {
    expect(parseDatePickerValue("2026-02-31")).toBeNull();
    expect(parseDatePickerValue("20/04/2026")).toBeNull();
    expect(parseDatePickerValue("")).toBeNull();
  });

  it("builds a stable six-week calendar grid for picker layout", () => {
    const grid = getCalendarMonthGrid(new Date(2026, 3, 1));

    expect(grid).toHaveLength(42);
    expect(grid[0]).toMatchObject({ dateValue: "2026-03-29", inCurrentMonth: false });
    expect(grid.find((day) => day.dateValue === "2026-04-20")).toMatchObject({
      dayLabel: "20",
      inCurrentMonth: true,
    });
    expect(grid[41]).toMatchObject({ dateValue: "2026-05-09", inCurrentMonth: false });
  });
});
