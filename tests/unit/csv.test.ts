import { describe, expect, it } from "vitest";
import { buildMonthlySeries, detectDayFirst, guessMapping, isConsecutive, parseCsv, toMonthKey, toNumber } from "@/lib/data/csv";

const csv = (lines: string[]) => parseCsv(lines.join("\n"));

describe("parseCsv and column mapping", () => {
  it("strips a BOM, trims headers and guesses the mapping", () => {
    const p = parseCsv("﻿ Date , Sales ,Product,Region\n2024-01-01,10,Lemon,North\n");
    expect(p.headers).toEqual(["Date", "Sales", "Product", "Region"]);
    expect(guessMapping(p.headers)).toEqual({ date: "Date", value: "Sales", product: "Product", region: "Region" });
  });

  it("guesses FRED-style headers", () => {
    expect(guessMapping(["observation_date", "IPN31211N"]).date).toBe("observation_date");
  });
});

describe("date and number parsing", () => {
  it.each([
    ["2024-03", "2024-03"],
    ["2024-03-15", "2024-03"],
    ["2024/03/15", "2024-03"],
    ["2024-03-15T10:00:00Z", "2024-03"],
    ["03/2024", "2024-03"],
    ["Mar 2024", "2024-03"],
    ["March-2024", "2024-03"],
    ["Sept 2024", "2024-09"],
    ["2024 Mar", "2024-03"],
  ])("%s -> %s", (raw, expected) => expect(toMonthKey(raw)).toBe(expected));

  it("rejects invalid dates", () => {
    for (const bad of ["", "hello", "2024-13", "13/2024", "Foo 2024"]) expect(toMonthKey(bad)).toBeNull();
  });

  it("detects day-first vs month-first slash dates", () => {
    expect(detectDayFirst(["25/01/2024", "03/02/2024"])).toBe(true);
    expect(detectDayFirst(["01/25/2024", "02/03/2024"])).toBe(false);
    expect(toMonthKey("03/02/2024", true)).toBe("2024-02");
    expect(toMonthKey("03/02/2024", false)).toBe("2024-03");
  });

  it("parses numbers with thousands separators and currency", () => {
    expect(toNumber("1,234.5")).toBe(1234.5);
    expect(toNumber("$99")).toBe(99);
    expect(toNumber("n/a")).toBeNull();
  });
});

describe("buildMonthlySeries", () => {
  const map = { date: "date", value: "sales" };

  it("sorts unordered rows and sums several rows in one month", () => {
    const p = csv(["date,sales", "2024-03-01,5", "2024-01-10,1", "2024-02-01,2", "2024-01-20,3",
      "2024-04-01,4", "2024-05-01,5", "2024-06-01,6"]);
    const r = buildMonthlySeries(p.rows, map);
    expect(r.errors).toEqual([]);
    expect(r.series!.months).toEqual(["2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-06"]);
    expect(r.series!.values[0]).toBe(4);
    expect(r.report.monthsWithSeveralRows).toBe(1);
    expect(isConsecutive(r.series!.months)).toBe(true);
  });

  it("reports invalid dates and values with their row numbers", () => {
    const p = csv(["date,sales", "2024-01,1", "oops,2", "2024-02,abc", "2024-02,2", "2024-03,3", "2024-04,4",
      "2024-05,5", "2024-06,6"]);
    const r = buildMonthlySeries(p.rows, map);
    expect(r.report.invalidDates).toEqual([{ row: 3, value: "oops" }]);
    expect(r.report.invalidValues).toEqual([{ row: 4, value: "abc" }]);
    expect(r.warnings.join(" ")).toMatch(/skipped/);
  });

  it("blocks on missing months unless gap-filling is on, then marks them imputed", () => {
    const p = csv(["date,sales", "2024-01,10", "2024-02,20", "2024-04,40", "2024-05,50", "2024-06,60", "2024-07,70"]);
    const blocked = buildMonthlySeries(p.rows, map);
    expect(blocked.series).toBeNull();
    expect(blocked.report.missingMonths).toEqual(["2024-03"]);
    const filled = buildMonthlySeries(p.rows, map, { fillGaps: true });
    expect(filled.series!.values[2]).toBe(30);
    expect(filled.report.imputedMonths).toEqual(["2024-03"]);
  });

  it("filters by product and region", () => {
    const p = csv(["date,sales,product,region", ...Array.from({ length: 6 }, (_, i) =>
      [`2024-0${i + 1},1,Lemon,North`, `2024-0${i + 1},100,Mint,North`, `2024-0${i + 1},1000,Lemon,South`]).flat()]);
    const r = buildMonthlySeries(p.rows, { ...map, product: "product", region: "region" }, { product: "Lemon", region: "North" });
    expect(r.series!.values).toEqual([1, 1, 1, 1, 1, 1]);
    expect(r.report.products).toEqual(["Lemon", "Mint"]);
  });

  it("caps long series at the most recent 240 months", () => {
    const lines = ["date,sales"];
    for (let i = 0; i < 300; i++) lines.push(`${2000 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")},${i}`);
    const r = buildMonthlySeries(csv(lines).rows, map);
    expect(r.series!.values).toHaveLength(240);
    expect(r.series!.values.at(-1)).toBe(299);
    expect(r.report.truncatedTo).toBe(240);
  });

  it("needs at least 6 months and distinct columns", () => {
    expect(buildMonthlySeries(csv(["date,sales", "2024-01,1", "2024-02,2"]).rows, map).errors.join(" ")).toMatch(/at least 6/);
    expect(buildMonthlySeries([], { date: "x", value: "x" }).errors[0]).toMatch(/different/);
  });
});
