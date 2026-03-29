import { formatDateTimeLocalValue, serializeDateTimeLocalValue } from "@/lib/datetimeLocal";

describe("datetimeLocal helpers", () => {
  it("round-trips a datetime-local value through ISO serialization", () => {
    const localValue = "2026-03-29T20:15";

    const isoValue = serializeDateTimeLocalValue(localValue);

    expect(isoValue).not.toBeNull();
    expect(formatDateTimeLocalValue(isoValue)).toBe(localValue);
  });

  it("returns empty output for missing or invalid values", () => {
    expect(formatDateTimeLocalValue(null)).toBe("");
    expect(formatDateTimeLocalValue("not-a-date")).toBe("");
    expect(serializeDateTimeLocalValue("")).toBeNull();
    expect(serializeDateTimeLocalValue("not-a-date")).toBeNull();
  });
});
