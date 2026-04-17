import { describe, it, expect } from "vitest";
import { generateMockTeeTimes } from "@/lib/mock-data";
import { haversineMiles } from "@/lib/geo";

const gilroy = { lat: 37.0139, lng: -121.5773, city: "Gilroy", state: "CA" };

describe("generateMockTeeTimes", () => {
  it("returns 30 tee times", () => {
    const tts = generateMockTeeTimes("95020", 25, gilroy);
    expect(tts).toHaveLength(30);
  });

  it("uses the supplied center city/state on every course", () => {
    const tts = generateMockTeeTimes("95020", 25, gilroy);
    for (const t of tts) {
      expect(t.city).toBe("Gilroy");
      expect(t.state).toBe("CA");
      expect(t.zipCode).toBe("95020");
    }
  });

  it("every course is within the requested radius (Haversine check)", () => {
    const radius = 25;
    const tts = generateMockTeeTimes("95020", radius, gilroy);
    for (const t of tts) {
      const real = haversineMiles(gilroy.lat, gilroy.lng, t.latitude, t.longitude);
      expect(real).toBeLessThanOrEqual(radius + 0.2);
      expect(t.distanceMiles).toBeLessThanOrEqual(radius + 0.2);
    }
  });

  it("distanceMiles matches the lat/lng Haversine within 0.2mi", () => {
    const tts = generateMockTeeTimes("95020", 25, gilroy);
    for (const t of tts) {
      const real = haversineMiles(gilroy.lat, gilroy.lng, t.latitude, t.longitude);
      expect(Math.abs(real - t.distanceMiles)).toBeLessThan(0.2);
    }
  });

  it("results are sorted by distance ascending", () => {
    const tts = generateMockTeeTimes("95020", 25, gilroy);
    for (let i = 1; i < tts.length; i++) {
      expect(tts[i].distanceMiles).toBeGreaterThanOrEqual(tts[i - 1].distanceMiles);
    }
  });

  it("price never exceeds originalPrice and is >= 0", () => {
    const tts = generateMockTeeTimes("95020", 25, gilroy);
    for (const t of tts) {
      expect(t.price).toBeGreaterThanOrEqual(0);
      expect(t.price).toBeLessThanOrEqual(t.originalPrice);
    }
  });

  it("tier classification is consistent with rating+basePrice rules", () => {
    const tts = generateMockTeeTimes("95020", 25, gilroy);
    for (const t of tts) {
      if (t.tier === "premium") {
        expect(t.rating).toBeGreaterThanOrEqual(4.3);
        expect(t.originalPrice).toBeGreaterThanOrEqual(70);
      } else if (t.tier === "budget") {
        expect(t.rating).toBeLessThan(3.8);
        expect(t.originalPrice).toBeLessThan(60);
      }
    }
  });

  it("rating is between 2.5 and 5.0", () => {
    const tts = generateMockTeeTimes("95020", 25, gilroy);
    for (const t of tts) {
      expect(t.rating).toBeGreaterThanOrEqual(2.5);
      expect(t.rating).toBeLessThanOrEqual(5.0);
    }
  });

  it("holes is either 9 or 18", () => {
    const tts = generateMockTeeTimes("95020", 25, gilroy);
    for (const t of tts) {
      expect([9, 18]).toContain(t.holes);
    }
  });

  it("all ids are unique", () => {
    const tts = generateMockTeeTimes("95020", 25, gilroy);
    const ids = new Set(tts.map((t) => t.id));
    expect(ids.size).toBe(tts.length);
  });

  it("smaller radius produces smaller max distance", () => {
    const small = generateMockTeeTimes("95020", 5, gilroy);
    const big = generateMockTeeTimes("95020", 50, gilroy);
    const maxSmall = Math.max(...small.map((t) => t.distanceMiles));
    const maxBig = Math.max(...big.map((t) => t.distanceMiles));
    expect(maxSmall).toBeLessThanOrEqual(5.2);
    expect(maxBig).toBeGreaterThan(10);
  });
});
