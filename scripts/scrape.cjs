#!/usr/bin/env node
/**
 * GolfNow scraper — intercepts the courses-near-me API for accurate data.
 * Usage: node scripts/scrape.cjs <zipCode> [radiusMiles]
 * Output: writes results to data/cache/<zipCode>.json
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

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

  const searchUrl = `https://www.golfnow.com/tee-times/search#latitude=${coords.lat}&longitude=${coords.lng}&date=${dateStr}&radius=${radiusMiles}&players=2`;

  console.log("Launching Chrome...");
  const browser = await chromium.launch({ headless: false, channel: "chrome" });
  const page = await browser.newPage();

  // Capture the API response with real facility data
  let apiData = null;
  page.on("response", async (response) => {
    if (response.url().includes("/api/tee-times/courses-near-me")) {
      try {
        apiData = await response.json();
      } catch {}
    }
  });

  try {
    console.log("Loading search page...");
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    console.log("Waiting for API response...");
    // Wait up to 20s for the API response
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      if (apiData) break;
    }

    if (!apiData || !apiData.ttResults?.facilities?.length) {
      console.error("No API data captured. GolfNow may have blocked the request.");
      await browser.close();
      process.exit(1);
    }

    const facilities = apiData.ttResults.facilities;
    console.log(`API returned ${facilities.length} facilities`);

    // Deduplicate by facility name
    const seen = new Set();
    const unique = facilities.filter((f) => {
      if (seen.has(f.name)) return false;
      seen.add(f.name);
      return true;
    });
    console.log(`${unique.length} unique after dedup`);

    // Transform to our tee time format
    const teeTimes = unique.map((f, i) => {
      const minPrice = f.minPrice?.value || 0;
      const maxPrice = f.maxPrice?.value || 0;
      const addr = f.address || {};
      const rating = f.averageRating || 0;

      // Tier based on GolfNow's own isPremium flag + price
      let tier = "standard";
      if (f.isPremium || (rating >= 4.3 && minPrice >= 70)) tier = "premium";
      else if (rating < 3.8 && minPrice > 0 && minPrice < 40) tier = "budget";

      // Build booking URL
      const bookingUrl = `https://www.golfnow.com/tee-times/facility/${f.seoFriendlyName}/search#facilitytype=GolfCourse&players=2&date=${dateStr}`;

      // Earliest tee time
      let displayTime = "See GolfNow";
      if (f.minDate?.formatted) {
        displayTime = `${f.minDate.formatted} ${f.minDate.formattedTimeMeridian || ""}`.trim();
      }

      // Display date from API
      const displayDate = f.day || tomorrow.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

      return {
        id: `gn-${f.id}`,
        courseName: f.name,
        courseId: `gn-${f.id}`,
        address: addr.line1 || "",
        city: addr.city || "",
        state: addr.stateProvinceCode || "",
        zipCode: (addr.postalCode || "").replace(/-.*/, ""),
        latitude: f.latitude,
        longitude: f.longitude,
        dateTime: f.minDate?.date || new Date(tomorrow).toISOString(),
        displayTime,
        displayDate,
        players: 2,
        holes: 18,
        originalPrice: maxPrice,
        price: minPrice,
        isHotDeal: f.hasHotDeal || false,
        discount: maxPrice > minPrice ? Math.round(((maxPrice - minPrice) / maxPrice) * 100) : 0,
        rating: Math.round(rating * 10) / 10,
        reviewCount: f.numberOfReviews || 0,
        imageUrl: f.thumbnailImagePath || "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=400&h=250&fit=crop",
        bookingUrl,
        distanceMiles: f.distance || 0,
        tier,
        numberOfTeeTimes: f.numberOfTeeTimes || 0,
      };
    }).sort((a, b) => a.distanceMiles - b.distanceMiles);

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

    // Print summary
    console.log("\n" + "=".repeat(100));
    for (const t of teeTimes) {
      const priceStr = t.price > 0 ? `$${t.price}` : "  -";
      const dealStr = t.isHotDeal ? " HOT" : "    ";
      console.log(
        `  ${priceStr.padStart(4)}${dealStr}  ${t.courseName.padEnd(45)} ${t.city.padEnd(15)} ${t.state}  ${String(t.distanceMiles).padStart(2)}mi  ${t.rating}★  ${t.tier}`
      );
    }
    console.log("=".repeat(100));
  } finally {
    await browser.close();
  }
}

const [zipCode, radius] = process.argv.slice(2);
if (!zipCode) {
  console.log("Usage: node scripts/scrape.cjs <zipCode> [radiusMiles]");
  process.exit(1);
}
scrape(zipCode, parseInt(radius) || 25);
