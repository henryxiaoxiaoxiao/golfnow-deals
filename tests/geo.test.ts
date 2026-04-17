import { describe, it, expect } from "vitest";
import {
  haversineMiles,
  milesPerDegLng,
  randomPointInRadius,
} from "@/lib/geo";

describe("haversineMiles", () => {
  it("returns 0 for identical points", () => {
    expect(haversineMiles(37.5, -122, 37.5, -122)).toBe(0);
  });

  it("NYC to LA is ~2445 miles (±20)", () => {
    const d = haversineMiles(40.7128, -74.006, 34.0522, -118.2437);
    expect(d).toBeGreaterThan(2425);
    expect(d).toBeLessThan(2465);
  });

  it("SF to San Jose is ~42 miles (±3)", () => {
    const d = haversineMiles(37.7749, -122.4194, 37.3382, -121.8863);
    expect(d).toBeGreaterThan(39);
    expect(d).toBeLessThan(45);
  });

  it("is symmetric", () => {
    const ab = haversineMiles(37, -122, 40, -74);
    const ba = haversineMiles(40, -74, 37, -122);
    expect(Math.abs(ab - ba)).toBeLessThan(0.001);
  });
});

describe("milesPerDegLng", () => {
  it("is 69 at equator", () => {
    expect(milesPerDegLng(0)).toBeCloseTo(69, 5);
  });

  it("shrinks with latitude", () => {
    expect(milesPerDegLng(60)).toBeCloseTo(34.5, 1);
  });

  it("is ~0 at poles", () => {
    expect(Math.abs(milesPerDegLng(90))).toBeLessThan(1e-10);
  });
});

describe("randomPointInRadius", () => {
  it("all 1000 points land within the radius (flat-earth approximation, <0.5% overshoot)", () => {
    const lat = 37.5;
    const lng = -122;
    const radius = 25;
    const tolerance = radius * 0.005; // Flat-earth math vs Haversine drifts ~0.3%
    for (let i = 0; i < 1000; i++) {
      const p = randomPointInRadius(lat, lng, radius);
      const d = haversineMiles(lat, lng, p.lat, p.lng);
      expect(d).toBeLessThanOrEqual(radius + tolerance);
    }
  });

  it("distribution covers the full radius (at least one point > 80% of radius)", () => {
    const lat = 37.5;
    const lng = -122;
    const radius = 25;
    let maxD = 0;
    for (let i = 0; i < 1000; i++) {
      const p = randomPointInRadius(lat, lng, radius);
      const d = haversineMiles(lat, lng, p.lat, p.lng);
      if (d > maxD) maxD = d;
    }
    expect(maxD).toBeGreaterThan(radius * 0.8);
  });
});
