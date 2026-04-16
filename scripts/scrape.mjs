#!/usr/bin/env node
/**
 * Standalone GolfNow scraper.
 * Usage: node scripts/scrape.mjs <zipCode> [radiusMiles]
 * Output: writes results to data/cache/<zipCode>.json
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, "..", "data", "cache");

async function zipToCoords(zipCode) {
  const res = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
  if (!res.ok) return null;
  const data = await res.json();
  const place = data.places?.[0];
  if (!place) return null;
  return {
    lat: parseFloat(place.latitude),
    lng: parseFloat(place.longitude),
    city: place["place name"],
    state: place["state abbreviation"],
  };
}

const STATE_MAP = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS",
  Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA",
  Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT",
  Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
  Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX",
  Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA",
  "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

function haversine(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function scrape(zipCode, radiusMiles = 25) {
  const coords = await zipToCoords(zipCode);
  if (!coords) {
    console.error(`Could not geocode zip code: ${zipCode}`);
    process.exit(1);
  }
  console.log(`${zipCode} → ${coords.city}, ${coords.state} (${coords.lat}, ${coords.lng})`);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split("T")[0];

  const searchUrl = `https://www.golfnow.com/tee-times/search#sortby=Date&view=Course&latitude=${coords.lat}&longitude=${coords.lng}&date=${dateStr}&radius=${radiusMiles}&players=2&holes=All&timemin=10&timemax=42&pricemin=0&pricemax=10000`;

  console.log("Launching Chrome...");
  const browser = await chromium.launch({ headless: false, channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();

  try {
    console.log("Loading search page...");
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    console.log("Waiting 12s for results to render...");
    await page.waitForTimeout(12000);

    // Extract course data from .course-details elements (each course listing)
    const courses = await page.$$eval(".course-details", (details) =>
      details.map((el) => {
        // Go up to find the full card section
        const card = el.closest("section") || el.parentElement?.parentElement || el;

        const nameEl = el.querySelector(".line-clamp-1, .font-display");
        const name = nameEl?.textContent?.trim() || "";

        // Location
        const distEl = el.querySelector(".course-distance");
        const locText = distEl?.parentElement?.textContent?.trim() || "";
        let city = "", state = "", zip = "";
        const locMatch = locText.match(/([^,]+)\s*,\s*([^,]+)\s*,\s*([\d-]+)/);
        if (locMatch) { city = locMatch[1].trim(); state = locMatch[2].trim(); zip = locMatch[3].trim(); }
        const distMatch = locText.match(/([\d.]+)\s*mi/);
        const distance = distMatch ? parseFloat(distMatch[1]) : 0;

        // Reviews
        const reviewEl = el.querySelector(".review-count");
        const reviewCount = parseInt((reviewEl?.textContent || "0").replace(/[^0-9]/g, "")) || 0;

        // Price — search in the parent section for dollar amounts
        const sectionText = card?.textContent || "";
        const prices = [...sectionText.matchAll(/\$(\d+)/g)].map((m) => parseInt(m[1])).filter((p) => p > 5);
        const price = prices.length > 0 ? Math.min(...prices) : 0;

        // Time
        const timeMatch = sectionText.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
        const time = timeMatch ? timeMatch[1] : "";

        // Image from background-image style
        const bgEl = card?.querySelector("[style*='background']");
        const bgStyle = bgEl?.getAttribute("style") || "";
        const imgMatch = bgStyle.match(/url\(['"]?([^'")\s]+)['"]?\)/);
        const img = imgMatch ? imgMatch[1] : "";

        // Booking link
        const linkEl = card?.querySelector("a[href*='facility'], a[href*='tee-times/search']");
        const link = linkEl?.getAttribute("href") || "";

        // Hot deal badge
        const isHotDeal = sectionText.toLowerCase().includes("hot deal");

        return { name, city, state, zip, distance, reviewCount, price, time, img, link, isHotDeal };
      })
    );

    console.log(`Extracted ${courses.length} courses`);

    // Format results — keep courses even without price (user clicks through to GolfNow)
    const teeTimes = courses
      .filter((c) => c.name)
      .map((c, i) => {
        const stateAbbr = STATE_MAP[c.state] || c.state;
        const bookingUrl = c.link
          ? c.link.startsWith("http") ? c.link : `https://www.golfnow.com${c.link}`
          : "https://www.golfnow.com/tee-times/search";

        const rating = 3.5 + (c.reviewCount > 200 ? 1 : c.reviewCount > 50 ? 0.5 : 0);
        let tier = "standard";
        if (rating >= 4.3 && c.price >= 70) tier = "premium";
        else if (rating < 3.8 && c.price < 60) tier = "budget";

        return {
          id: `gn-${i}`,
          courseName: c.name,
          courseId: `gn-${i}`,
          address: "",
          city: c.city,
          state: stateAbbr,
          zipCode: c.zip,
          latitude: coords.lat,
          longitude: coords.lng,
          dateTime: new Date(tomorrow).toISOString(),
          displayTime: c.time || "See GolfNow",
          displayDate: tomorrow.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
          players: 2,
          holes: 18,
          originalPrice: c.price,
          price: c.price,
          isHotDeal: c.isHotDeal,
          discount: 0,
          rating,
          reviewCount: c.reviewCount,
          imageUrl: c.img || "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=400&h=250&fit=crop",
          bookingUrl,
          distanceMiles: c.distance,
          tier,
        };
      })
      .sort((a, b) => a.price - b.price);

    // Save to cache
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const cacheFile = path.join(CACHE_DIR, `${zipCode}.json`);
    const cacheData = {
      zipCode,
      radiusMiles,
      scrapedAt: new Date().toISOString(),
      coords,
      teeTimes,
    };
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
    console.log(`\nSaved ${teeTimes.length} results to ${cacheFile}`);

    for (const t of teeTimes.slice(0, 10)) {
      console.log(`  $${t.price.toString().padStart(3)}  ${t.courseName.padEnd(45)} ${t.city.padEnd(15)} ${t.state}  ${t.distanceMiles}mi`);
    }
  } finally {
    await browser.close();
  }
}

const [zipCode, radius] = process.argv.slice(2);
if (!zipCode) {
  console.log("Usage: node scripts/scrape.mjs <zipCode> [radiusMiles]");
  process.exit(1);
}
scrape(zipCode, parseInt(radius) || 25);
