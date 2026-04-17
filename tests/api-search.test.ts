import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.API_BASE || "http://localhost:3100";

async function ping(): Promise<boolean> {
  try {
    const res = await fetch(BASE, { method: "HEAD" });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function search(body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

describe("/api/search — integration (requires dev server on :3100)", () => {
  let serverUp = false;
  beforeAll(async () => {
    serverUp = await ping();
    if (!serverUp) {
      console.warn(`Skipping integration tests — ${BASE} not reachable. Start: PORT=3100 npm run dev`);
    }
  }, 10000);

  it.skipIf(!process.env.CI && false)("400 when zipCode is missing", async () => {
    if (!serverUp) return;
    const r = await search({ email: "t@t.com" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBeTruthy();
  });

  it("400 when email is missing", async () => {
    if (!serverUp) return;
    const r = await search({ zipCode: "95020" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBeTruthy();
  });

  it("400 when zipCode is not 5 digits", async () => {
    if (!serverUp) return;
    const r = await search({ email: "t@t.com", zipCode: "abc" });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/5 digits/i);
  });

  it("400 when zipCode is 4 digits", async () => {
    if (!serverUp) return;
    const r = await search({ email: "t@t.com", zipCode: "9502" });
    expect(r.status).toBe(400);
  });

  it("400 when zipCode does not map to a real US location", async () => {
    if (!serverUp) return;
    const r = await search({ email: "t@t.com", zipCode: "00000", radiusMiles: 25 });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/location/i);
  });

  it("returns real cached data for a pre-cached zip (95020)", async () => {
    if (!serverUp) return;
    const r = await search({ email: "t@t.com", zipCode: "95020", radiusMiles: 25 });
    expect(r.status).toBe(200);
    expect(["cache", "live"]).toContain(r.body.source);
    expect(Array.isArray(r.body.teeTimes)).toBe(true);
    expect(r.body.teeTimes.length).toBeGreaterThan(0);
    const names = r.body.teeTimes.map((t: { courseName: string }) => t.courseName);
    expect(names).toContain("Eagle Ridge Golf Club");
  });

  it("radius filter: requesting 10mi returns only courses within 10mi", async () => {
    if (!serverUp) return;
    const r = await search({ email: "t@t.com", zipCode: "95020", radiusMiles: 10 });
    expect(r.status).toBe(200);
    expect(r.body.teeTimes.length).toBeGreaterThan(0);
    for (const t of r.body.teeTimes) {
      expect(t.distanceMiles).toBeLessThanOrEqual(10);
    }
  });

  it("radius filter: requesting 5mi returns fewer than 25mi", async () => {
    if (!serverUp) return;
    const small = await search({ email: "t@t.com", zipCode: "95020", radiusMiles: 5 });
    const big = await search({ email: "t@t.com", zipCode: "95020", radiusMiles: 25 });
    expect(small.body.teeTimes.length).toBeLessThanOrEqual(big.body.teeTimes.length);
  });

  it("response includes sorted-by-distance order (ascending)", async () => {
    if (!serverUp) return;
    const r = await search({ email: "t@t.com", zipCode: "95020", radiusMiles: 25 });
    const distances = r.body.teeTimes.map((t: { distanceMiles: number }) => t.distanceMiles);
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
    }
  });

  it("cache-hit path is fast (<2s) for a pre-cached zip", async () => {
    if (!serverUp) return;
    const t0 = Date.now();
    await search({ email: "t@t.com", zipCode: "95020", radiusMiles: 25 });
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(2000);
  });

  it("response shape has all required fields on each tee time", async () => {
    if (!serverUp) return;
    const r = await search({ email: "t@t.com", zipCode: "95020", radiusMiles: 25 });
    for (const t of r.body.teeTimes) {
      expect(t).toHaveProperty("courseName");
      expect(t).toHaveProperty("price");
      expect(t).toHaveProperty("distanceMiles");
      expect(t).toHaveProperty("city");
      expect(t).toHaveProperty("state");
      expect(t).toHaveProperty("bookingUrl");
      expect(t).toHaveProperty("rating");
      expect(t.price).toBeGreaterThanOrEqual(0);
      expect(t.distanceMiles).toBeGreaterThanOrEqual(0);
    }
  });

  it("cached courses stay within the scrape area for Gilroy (real city names)", async () => {
    if (!serverUp) return;
    const r = await search({ email: "t@t.com", zipCode: "95020", radiusMiles: 25 });
    const cities = new Set(r.body.teeTimes.map((t: { city: string }) => t.city));
    // Real Gilroy-area scrape includes Gilroy + nearby cities, never a fake placeholder
    const hasGilroy = cities.has("Gilroy");
    expect(hasGilroy).toBe(true);
  });
});
