import { describe, it, expect } from "vitest";
import { applyFilters, applySort, filterAndSort } from "@/lib/filter-sort";
import { FilterState } from "@/types";
import { sampleTeeTimes } from "./fixtures";

const emptyFilters: FilterState = {
  hotDealsOnly: false,
  maxPrice: null,
  minRating: null,
  timeRange: null,
  holes: null,
  tier: null,
};

describe("applyFilters — single filter", () => {
  it("hotDealsOnly keeps only hot deals", () => {
    const out = applyFilters(sampleTeeTimes(), { ...emptyFilters, hotDealsOnly: true });
    expect(out).toHaveLength(2);
    expect(out.every((t) => t.isHotDeal)).toBe(true);
    expect(out.map((t) => t.id).sort()).toEqual(["b", "d"]);
  });

  it("maxPrice caps price (inclusive)", () => {
    const out = applyFilters(sampleTeeTimes(), { ...emptyFilters, maxPrice: 65 });
    expect(out.map((t) => t.id).sort()).toEqual(["a", "b", "e"]);
    expect(out.every((t) => t.price <= 65)).toBe(true);
  });

  it("minRating floors rating (inclusive)", () => {
    const out = applyFilters(sampleTeeTimes(), { ...emptyFilters, minRating: 4.4 });
    expect(out.map((t) => t.id).sort()).toEqual(["b", "c", "d", "e"]);
  });

  it("holes=9 keeps only 9-hole courses", () => {
    const out = applyFilters(sampleTeeTimes(), { ...emptyFilters, holes: 9 });
    expect(out.map((t) => t.id).sort()).toEqual(["b", "e"]);
  });

  it("holes=18 keeps only 18-hole courses", () => {
    const out = applyFilters(sampleTeeTimes(), { ...emptyFilters, holes: 18 });
    expect(out.map((t) => t.id).sort()).toEqual(["a", "c", "d"]);
  });

  it("tier=premium keeps only premium", () => {
    const out = applyFilters(sampleTeeTimes(), { ...emptyFilters, tier: "premium" });
    expect(out.map((t) => t.id).sort()).toEqual(["c", "d"]);
  });

  it("tier=budget keeps only budget", () => {
    const out = applyFilters(sampleTeeTimes(), { ...emptyFilters, tier: "budget" });
    expect(out.map((t) => t.id).sort()).toEqual(["b", "e"]);
  });

  it("empty filters keep everything", () => {
    const out = applyFilters(sampleTeeTimes(), emptyFilters);
    expect(out).toHaveLength(5);
  });

  it("does not mutate input array", () => {
    const input = sampleTeeTimes();
    const snapshot = [...input];
    applyFilters(input, { ...emptyFilters, hotDealsOnly: true });
    expect(input).toEqual(snapshot);
  });
});

describe("applySort", () => {
  it("sorts by price asc", () => {
    const out = applySort(sampleTeeTimes(), "price", "asc");
    expect(out.map((t) => t.id)).toEqual(["b", "e", "a", "d", "c"]);
  });

  it("sorts by price desc", () => {
    const out = applySort(sampleTeeTimes(), "price", "desc");
    expect(out.map((t) => t.id)).toEqual(["c", "d", "a", "e", "b"]);
  });

  it("sorts by distance asc (nearest first)", () => {
    const out = applySort(sampleTeeTimes(), "distance", "asc");
    expect(out.map((t) => t.id)).toEqual(["b", "a", "c", "d", "e"]);
  });

  it("sorts by distance desc (farthest first)", () => {
    const out = applySort(sampleTeeTimes(), "distance", "desc");
    expect(out.map((t) => t.id)).toEqual(["e", "d", "c", "a", "b"]);
  });

  it("sorts by rating desc (best first)", () => {
    const out = applySort(sampleTeeTimes(), "rating", "desc");
    expect(out.map((t) => t.id)).toEqual(["c", "d", "b", "e", "a"]);
  });

  it("sorts by rating asc (lowest first)", () => {
    const out = applySort(sampleTeeTimes(), "rating", "asc");
    // ratings: a=3.4, b=4.4, e=4.4, d=4.6, c=4.7
    expect(out.map((t) => t.id)).toEqual(["a", "b", "e", "d", "c"]);
  });

  it("sorts by time asc (earliest tee-time first, chronological)", () => {
    const out = applySort(sampleTeeTimes(), "time", "asc");
    // b=6:15AM, a=8AM, c=11:30AM, d=2:45PM, e=4PM
    expect(out.map((t) => t.id)).toEqual(["b", "a", "c", "d", "e"]);
  });

  it("sorts by time desc (latest tee-time first)", () => {
    const out = applySort(sampleTeeTimes(), "time", "desc");
    expect(out.map((t) => t.id)).toEqual(["e", "d", "c", "a", "b"]);
  });

  it("does not mutate input array", () => {
    const input = sampleTeeTimes();
    const before = input.map((t) => t.id).join(",");
    applySort(input, "distance", "desc");
    expect(input.map((t) => t.id).join(",")).toBe(before);
  });
});

describe("filterAndSort — combinations", () => {
  it("hotDealsOnly + sort by distance", () => {
    const out = filterAndSort(
      sampleTeeTimes(),
      { ...emptyFilters, hotDealsOnly: true },
      "distance",
      "asc"
    );
    expect(out.map((t) => t.id)).toEqual(["b", "d"]);
  });

  it("maxPrice=60 + tier=budget + sort by rating desc", () => {
    const out = filterAndSort(
      sampleTeeTimes(),
      { ...emptyFilters, maxPrice: 60, tier: "budget" },
      "rating",
      "desc"
    );
    expect(out.map((t) => t.id)).toEqual(["b", "e"]);
  });

  it("minRating=4.5 + holes=18 + sort by price asc", () => {
    const out = filterAndSort(
      sampleTeeTimes(),
      { ...emptyFilters, minRating: 4.5, holes: 18 },
      "price",
      "asc"
    );
    expect(out.map((t) => t.id)).toEqual(["d", "c"]);
  });

  it("very restrictive filters → empty", () => {
    const out = filterAndSort(
      sampleTeeTimes(),
      { ...emptyFilters, maxPrice: 10, tier: "premium" },
      "price",
      "asc"
    );
    expect(out).toEqual([]);
  });

  it("all filters + sort still returns consistent results", () => {
    const out = filterAndSort(
      sampleTeeTimes(),
      {
        hotDealsOnly: true,
        maxPrice: 100,
        minRating: 4.0,
        timeRange: null,
        holes: 18,
        tier: "premium",
      },
      "price",
      "asc"
    );
    expect(out.map((t) => t.id)).toEqual(["d"]);
  });
});
