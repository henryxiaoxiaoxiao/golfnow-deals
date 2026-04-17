import { chromium, Browser } from "playwright";
import fs from "fs";
import path from "path";
import { TeeTime, CourseTier } from "@/types";
import { Coords } from "./geo";

const CACHE_DIR = path.join(process.cwd(), "data", "cache");
const SCRAPE_TIMEOUT_MS = 45000;

interface FacilityAddress {
  line1?: string;
  city?: string;
  stateProvinceCode?: string;
  postalCode?: string;
}

interface Facility {
  id: number | string;
  name: string;
  seoFriendlyName?: string;
  address?: FacilityAddress;
  latitude?: number;
  longitude?: number;
  minPrice?: { value?: number };
  maxPrice?: { value?: number };
  minDate?: { date?: string; formatted?: string; formattedTimeMeridian?: string };
  day?: string;
  averageRating?: number;
  numberOfReviews?: number;
  thumbnailImagePath?: string;
  distance?: number;
  isPremium?: boolean;
  hasHotDeal?: boolean;
  numberOfTeeTimes?: number;
}

interface ApiPayload {
  ttResults?: { facilities?: Facility[] };
}

const inFlight = new Map<string, Promise<TeeTime[] | null>>();

export async function scrapeGolfNow(
  zipCode: string,
  radiusMiles: number,
  coords: Coords
): Promise<TeeTime[] | null> {
  const key = `${zipCode}:${radiusMiles}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const task = runScrape(zipCode, radiusMiles, coords).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, task);
  return task;
}

async function runScrape(
  zipCode: string,
  radiusMiles: number,
  coords: Coords
): Promise<TeeTime[] | null> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split("T")[0];
  const searchUrl = `https://www.golfnow.com/tee-times/search#latitude=${coords.lat}&longitude=${coords.lng}&date=${dateStr}&radius=${radiusMiles}&players=2`;

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1440, height: 900 },
      locale: "en-US",
    });
    const page = await context.newPage();

    const captured: { data: ApiPayload | null } = { data: null };
    page.on("response", async (response) => {
      if (response.url().includes("/api/tee-times/courses-near-me")) {
        try {
          captured.data = (await response.json()) as ApiPayload;
        } catch {}
      }
    });

    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    const deadline = Date.now() + SCRAPE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (captured.data?.ttResults?.facilities?.length) break;
      await page.waitForTimeout(500);
    }

    const facilities = captured.data?.ttResults?.facilities ?? [];
    if (!facilities.length) {
      console.error(`scrape ${zipCode}: no facilities captured`);
      return null;
    }

    const seen = new Set<string>();
    const unique = facilities.filter((f) => {
      if (seen.has(f.name)) return false;
      seen.add(f.name);
      return true;
    });

    const teeTimes: TeeTime[] = unique.map((f) => {
      const minPrice = f.minPrice?.value || 0;
      const maxPrice = f.maxPrice?.value || 0;
      const addr = f.address || {};
      const rating = f.averageRating || 0;

      let tier: CourseTier = "standard";
      if (f.isPremium || (rating >= 4.3 && minPrice >= 70)) tier = "premium";
      else if (rating < 3.8 && minPrice > 0 && minPrice < 40) tier = "budget";

      const bookingUrl = `https://www.golfnow.com/tee-times/facility/${f.seoFriendlyName || ""}/search#facilitytype=GolfCourse&players=2&date=${dateStr}`;

      let displayTime = "See GolfNow";
      if (f.minDate?.formatted) {
        displayTime = `${f.minDate.formatted} ${f.minDate.formattedTimeMeridian || ""}`.trim();
      }

      const displayDate =
        f.day ||
        tomorrow.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

      return {
        id: `gn-${f.id}`,
        courseName: f.name,
        courseId: `gn-${f.id}`,
        address: addr.line1 || "",
        city: addr.city || "",
        state: addr.stateProvinceCode || "",
        zipCode: (addr.postalCode || "").replace(/-.*/, ""),
        latitude: f.latitude ?? coords.lat,
        longitude: f.longitude ?? coords.lng,
        dateTime: f.minDate?.date || tomorrow.toISOString(),
        displayTime,
        displayDate,
        players: 2,
        holes: 18,
        originalPrice: maxPrice,
        price: minPrice,
        isHotDeal: f.hasHotDeal || false,
        discount:
          maxPrice > minPrice
            ? Math.round(((maxPrice - minPrice) / maxPrice) * 100)
            : 0,
        rating: Math.round(rating * 10) / 10,
        reviewCount: f.numberOfReviews || 0,
        imageUrl:
          f.thumbnailImagePath ||
          "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=400&h=250&fit=crop",
        bookingUrl,
        distanceMiles: f.distance || 0,
        tier,
      };
    });

    teeTimes.sort((a, b) => a.distanceMiles - b.distanceMiles);

    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      const cacheFile = path.join(CACHE_DIR, `${zipCode}.json`);
      fs.writeFileSync(
        cacheFile,
        JSON.stringify(
          { zipCode, radiusMiles, scrapedAt: new Date().toISOString(), coords, teeTimes },
          null,
          2
        )
      );
    } catch (err) {
      console.error(`scrape ${zipCode}: cache write failed`, err);
    }

    return teeTimes;
  } catch (err) {
    console.error(`scrape ${zipCode}: error`, err);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
