import { formatISODateString } from "./dealUtils";

describe("formatISODateString", () => {
  let originalTimezone: string | undefined;

  beforeEach(() => {
    originalTimezone = process.env.TZ;
  });

  afterEach(() => {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  });

  it("formats a valid ISO date string correctly", () => {
    const isoDate = "2024-06-15";
    const formattedDate = formatISODateString(isoDate);
    expect(formattedDate).toBe("Jun 15, 2024");
  });

  it("should not shift the date regardless of timezone", () => {
    // Exercise timezone-independent date-only parsing in the Node test worker.
    const isoDate = "2024-06-15";
    process.env.TZ = "America/New_York";
    expect(formatISODateString(isoDate)).toBe("Jun 15, 2024");

    process.env.TZ = "Asia/Tokyo";
    expect(formatISODateString(isoDate)).toBe("Jun 15, 2024");

    process.env.TZ = "UTC";
    expect(formatISODateString(isoDate)).toBe("Jun 15, 2024");

    process.env.TZ = "Pacific/Auckland";
    expect(formatISODateString(isoDate)).toBe("Jun 15, 2024");
  });

  it("throw for an invalid date string", () => {
    const invalidDate = "invalid-date";
    expect(() => formatISODateString(invalidDate)).toThrow(
      "Invalid date format. Expected YYYY-MM-DD.",
    );
  });

  it("throw for a date string with wrong format", () => {
    const invalidDate = "15-06-2024";
    expect(() => formatISODateString(invalidDate)).toThrow(
      "Invalid date format. Expected YYYY-MM-DD.",
    );
  });
});
