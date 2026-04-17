import { describe, it, expect } from "vitest";
import { scrapeGolfNow } from "@/lib/scrape";

// Opt-in only: set RUN_LIVE=1 to actually hit GolfNow.
const run = process.env.RUN_LIVE === "1";

describe.skipIf(!run)("scrapeGolfNow — live smoke test", () => {
  it("scrapes 95131 (San Jose) and returns real courses", async () => {
    const tts = await scrapeGolfNow("95131", 25, {
      lat: 37.3858,
      lng: -121.8961,
      city: "San Jose",
      state: "CA",
    });
    expect(tts).not.toBeNull();
    expect(tts!.length).toBeGreaterThan(3);
    for (const t of tts!) {
      expect(t.courseName).toBeTruthy();
      expect(t.id).toMatch(/^gn-/);
      expect(t.distanceMiles).toBeGreaterThanOrEqual(0);
    }
  }, 90000);

  it("concurrent requests for the same zip dedupe into one browser run", async () => {
    const coords = { lat: 37.3858, lng: -121.8961, city: "San Jose", state: "CA" };
    const t0 = Date.now();
    const [a, b] = await Promise.all([
      scrapeGolfNow("95131", 25, coords),
      scrapeGolfNow("95131", 25, coords),
    ]);
    const elapsed = Date.now() - t0;
    expect(a).toEqual(b);
    // If dedupe works both complete around the time of a single scrape (< 90s)
    expect(elapsed).toBeLessThan(90000);
  }, 120000);
});
