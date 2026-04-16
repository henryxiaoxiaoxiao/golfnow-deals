import { chromium } from "playwright";
import { TeeTime, CourseTier } from "@/types";

// Zip code to lat/lng using free API
export async function zipToCoords(
  zipCode: string
): Promise<{ lat: number; lng: number; city: string; state: string } | null> {
  try {
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
  } catch {
    return null;
  }
}

function classifyTier(rating: number, price: number): CourseTier {
  if (rating >= 4.3 && price >= 70) return "premium";
  if (rating < 3.8 && price < 60) return "budget";
  return "standard";
}

interface GolfNowSearchParams {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  date?: string;
  players?: number;
}

export async function scrapeGolfNow(
  params: GolfNowSearchParams
): Promise<TeeTime[]> {
  const { latitude, longitude, radiusMiles, date, players = 2 } = params;

  const dateForUrl =
    date ||
    (() => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split("T")[0];
    })();

  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      channel: "chrome",
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
      timezoneId: "America/Los_Angeles",
    });
    const page = await context.newPage();

    // Navigate directly to the search URL — let GolfNow's own JS make the API call
    const searchUrl = `https://www.golfnow.com/tee-times/search#sortby=Date&view=Course&latitude=${latitude}&longitude=${longitude}&date=${dateForUrl}&radius=${radiusMiles}&players=${players}&holes=All&timemin=10&timemax=42&pricemin=0&pricemax=10000`;
    console.log("Loading GolfNow search page...");

    // Listen for GolfNow API responses containing tee time / course data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedData: any = null;
    page.on("response", async (response: { url: () => string; status: () => number; json: () => Promise<unknown>; headers: () => Record<string, string> }) => {
      const url = response.url();
      const isGolfNowApi =
        url.includes("golfnow.com/api/tee-times/") &&
        !url.includes("search-model") &&
        response.status() === 200 &&
        (response.headers()["content-type"] || "").includes("json");

      if (!isGolfNowApi) return;

      try {
        const data = await response.json();
        if (!data || typeof data !== "object") return;
        const d = data as Record<string, unknown>;

        // Log all GolfNow API responses for debugging
        const shortUrl = url.replace("https://www.golfnow.com", "");
        const keys = Object.keys(d);
        console.log(`API [${shortUrl.split("?")[0]}] keys: ${keys.join(", ")}`);

        // Accept any tee-times API response with meaningful data
        const hasData =
          d.facilities || d.Facilities ||
          d.teeTimes || d.TeeTimes ||
          d.results || d.Results ||
          d.courses || d.Courses ||
          d.html || d.Html ||
          keys.length > 2;

        if (hasData && !capturedData) {
          console.log(`Captured data from: ${shortUrl.split("?")[0]}`);
          capturedData = data;
        }
      } catch {
        // Not JSON
      }
    });

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for the SPA to fully load and render results
    console.log("Waiting for page to render...");
    await page.waitForTimeout(12000);

    if (capturedData) {
      console.log("Got API data, parsing...");
      const teeTimes = parseApiResponse(capturedData, latitude, longitude, players);
      console.log(`Parsed ${teeTimes.length} tee times`);
      return teeTimes;
    }

    // Fallback: try scraping the rendered HTML
    console.log("No API data captured, trying HTML scrape...");
    return await scrapePageHtml(page, latitude, longitude);
  } catch (error) {
    console.error("GolfNow scrape error:", error);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

function formatDateForApi(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseApiResponse(data: any, userLat: number, userLng: number, playerCount: number): TeeTime[] {
  const teeTimes: TeeTime[] = [];

  // GolfNow returns various response shapes
  const facilities =
    data?.facilities ||
    data?.Facilities ||
    data?.results ||
    data?.Results ||
    [];

  if (!Array.isArray(facilities) || facilities.length === 0) {
    // Try flat tee time list
    const flatTimes = data?.teeTimes || data?.TeeTimes || [];
    if (Array.isArray(flatTimes) && flatTimes.length > 0) {
      return parseFlatTeeTimes(flatTimes, userLat, userLng, playerCount);
    }
    // Try HTML response — GolfNow sometimes returns rendered HTML
    if (data?.html || data?.Html) {
      console.log("Got HTML response from API, will use page scraping instead");
      return [];
    }
    console.log("No facilities found in API response. Keys:", Object.keys(data || {}).slice(0, 10));
    return [];
  }

  for (const facility of facilities) {
    const course = facility.facility || facility.Facility || facility;
    const courseName = course.name || course.Name || course.facilityName || "Unknown Course";
    const courseId = String(course.id || course.Id || course.facilityId || "");
    const address = course.address || course.Address || "";
    const city = course.city || course.City || "";
    const state = course.state || course.State || course.stateOrProvince || "";
    const lat = parseFloat(course.latitude || course.Latitude || 0);
    const lng = parseFloat(course.longitude || course.Longitude || 0);
    const rating = parseFloat(course.rating || course.Rating || course.courseRating || 0);
    const reviewCount = parseInt(course.reviewCount || course.ReviewCount || course.numberOfReviews || 0);
    const imageUrl =
      course.image || course.Image || course.imageUrl || course.thumbnailUrl ||
      "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=400&h=250&fit=crop";

    const times = facility.teeTimes || facility.TeeTimes || facility.teetimes || facility.rates || [];

    for (const tt of times) {
      const dateTime = tt.dateTime || tt.DateTime || tt.time || tt.Time || "";
      const price = parseFloat(tt.greensFee || tt.GreensFee || tt.discountRate || tt.price || 0);
      const originalPrice = parseFloat(tt.retailRate || tt.RetailRate || tt.originalPrice || price);
      const isHotDeal = !!(tt.isHotDeal || tt.IsHotDeal);
      const holes = parseInt(tt.holeCount || tt.HoleCount || tt.holes || 18);

      const d = new Date(dateTime);
      const displayTime = isNaN(d.getTime())
        ? "N/A"
        : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      const displayDate = isNaN(d.getTime())
        ? "N/A"
        : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

      const discount =
        originalPrice > price
          ? Math.round(((originalPrice - price) / originalPrice) * 100)
          : 0;

      const distanceMiles = haversineDistance(userLat, userLng, lat, lng);
      const normalizedRating = rating > 5 ? rating / 20 : rating;

      teeTimes.push({
        id: `gn-${courseId}-${dateTime}`,
        courseName,
        courseId,
        address,
        city,
        state,
        zipCode: "",
        latitude: lat,
        longitude: lng,
        dateTime,
        displayTime,
        displayDate,
        players: playerCount,
        holes,
        originalPrice,
        price,
        isHotDeal,
        discount,
        rating: normalizedRating,
        reviewCount,
        imageUrl: imageUrl.startsWith("//") ? `https:${imageUrl}` : imageUrl,
        bookingUrl: `https://www.golfnow.com/tee-times/facility/${courseId}/search`,
        distanceMiles: Math.round(distanceMiles * 10) / 10,
        tier: classifyTier(normalizedRating, originalPrice),
      });
    }
  }

  return teeTimes.sort((a, b) => a.price - b.price);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFlatTeeTimes(times: any[], userLat: number, userLng: number, playerCount: number): TeeTime[] {
  return times
    .map((tt, i) => {
      const facility = tt.golfFacility || tt.facility || {};
      const courseName = facility.name || tt.courseName || "Unknown";
      const courseId = String(facility.id || tt.facilityId || i);
      const lat = parseFloat(facility.latitude || 0);
      const lng = parseFloat(facility.longitude || 0);
      const price = parseFloat(tt.discountRate || tt.greensFee || tt.price || 0);
      const originalPrice = parseFloat(tt.retailRate || tt.originalPrice || price);
      const rating = parseFloat(facility.rating || 0);
      const normalizedRating = rating > 5 ? rating / 20 : rating;

      const dateTime = tt.dateTime || tt.time || "";
      const d = new Date(dateTime);

      return {
        id: `gn-${courseId}-${dateTime}`,
        courseName,
        courseId,
        address: facility.address || "",
        city: facility.city || "",
        state: facility.stateOrProvince || facility.state || "",
        zipCode: "",
        latitude: lat,
        longitude: lng,
        dateTime,
        displayTime: isNaN(d.getTime())
          ? "N/A"
          : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        displayDate: isNaN(d.getTime())
          ? "N/A"
          : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        players: playerCount,
        holes: parseInt(tt.holeCount || 18),
        originalPrice,
        price,
        isHotDeal: !!(tt.isHotDeal),
        discount: originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
        rating: normalizedRating,
        reviewCount: parseInt(facility.numberOfReviews || 0),
        imageUrl: facility.image
          ? facility.image.startsWith("//") ? `https:${facility.image}` : facility.image
          : "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=400&h=250&fit=crop",
        bookingUrl: `https://www.golfnow.com/tee-times/facility/${courseId}/search`,
        distanceMiles: Math.round(haversineDistance(userLat, userLng, lat, lng) * 10) / 10,
        tier: classifyTier(normalizedRating, originalPrice),
      } as TeeTime;
    })
    .sort((a, b) => a.price - b.price);
}

async function scrapePageHtml(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  userLat: number,
  userLng: number
): Promise<TeeTime[]> {
  // Check how many course cards are on the page
  const cardCount = await page.$$eval(".featured-course-container", (els: HTMLElement[]) => els.length);
  console.log(`Found ${cardCount} course cards in HTML`);
  if (cardCount === 0) return [];

  const cards = await page.$$eval(
    ".featured-course-container",
    (elements: HTMLElement[]) =>
      elements.map((card) => {
        // Course name
        const nameEl = card.querySelector(".line-clamp-1, .font-display");
        const name = nameEl?.textContent?.trim() || "";

        // Location text — e.g., "Livermore, California, 94550-9645 | 18mi away"
        const locationEl = card.querySelector(".course-distance");
        const locText = locationEl?.parentElement?.textContent?.trim() || "";

        // Parse city, state from text before the pipe
        let city = "", state = "", zip = "";
        const locMatch = locText.match(/^([^,]+),\s*([^,]+),\s*([\d-]+)/);
        if (locMatch) {
          city = locMatch[1].trim();
          state = locMatch[2].trim();
          zip = locMatch[3].trim();
        }

        // Distance
        const distMatch = locText.match(/([\d.]+)\s*mi/);
        const distance = distMatch ? parseFloat(distMatch[1]) : 0;

        // Reviews
        const reviewEl = card.querySelector(".review-count");
        const reviewText = reviewEl?.textContent?.trim() || "0";
        const reviewCount = parseInt(reviewText.replace(/[^0-9]/g, "")) || 0;

        // Rating (stars) — look for star elements or rating value
        const ratingEl = card.querySelector(".course-rating");
        const ratingText = ratingEl?.textContent?.trim() || "";
        const ratingMatch = ratingText.match(/([\d.]+)/);

        // Price — text in the right column
        const priceEls = card.querySelectorAll("[class*='col-span-4'] *");
        let price = 0;
        for (const el of priceEls) {
          const t = el.textContent || "";
          const m = t.match(/\$(\d+)/);
          if (m) { price = parseInt(m[1]); break; }
        }
        // Fallback: find any dollar amount in the card
        if (!price) {
          const allText = card.textContent || "";
          const priceMatch = allText.match(/\$(\d+)/);
          if (priceMatch) price = parseInt(priceMatch[1]);
        }

        // Time
        const timeEl = card.querySelector(".time-meridian, [class*='time']");
        const timeText = timeEl?.textContent?.trim() || "";
        const timeMatch = timeText.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);

        // Image
        const cardStyle = card.querySelector("[class*='bg-cover']")?.getAttribute("style") || "";
        const imgMatch = cardStyle.match(/url\(['"]?([^'")\s]+)['"]?\)/);
        const img = imgMatch ? imgMatch[1] : "";

        // Booking link
        const link = card.querySelector("a[href*='facility']")?.getAttribute("href") || "";

        // Hot deal badge
        const isHotDeal = !!(card.querySelector("[class*='hot-deal'], [class*='Hot']") ||
          card.textContent?.includes("Hot Deal"));

        return {
          name,
          city,
          state,
          zip,
          distance,
          reviewCount,
          rating: ratingMatch ? parseFloat(ratingMatch[1]) : 0,
          price,
          time: timeMatch ? timeMatch[1] : timeText.substring(0, 20),
          img,
          link,
          isHotDeal,
        };
      })
  );

  console.log(`Scraped ${cards.length} course cards from HTML`);

  return cards
    .filter((c: { name: string; price: number }) => c.name && c.price > 0)
    .map((card: {
      name: string; city: string; state: string; zip: string;
      distance: number; reviewCount: number; rating: number;
      price: number; time: string; img: string; link: string; isHotDeal: boolean;
    }, i: number) => {
      const stateAbbr = stateToAbbr(card.state) || card.state;
      const bookingUrl = card.link
        ? (card.link.startsWith("http") ? card.link : `https://www.golfnow.com${card.link}`)
        : "https://www.golfnow.com/tee-times/search";
      const normalizedRating = card.rating > 5 ? card.rating / 20 : (card.rating || 3.5);

      return {
        id: `gn-${i}-${card.name.substring(0, 10)}`,
        courseName: card.name,
        courseId: `gn-html-${i}`,
        address: "",
        city: card.city,
        state: stateAbbr,
        zipCode: card.zip,
        latitude: userLat,
        longitude: userLng,
        dateTime: new Date().toISOString(),
        displayTime: card.time || "See Times",
        displayDate: new Date(Date.now() + 86400000).toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric",
        }),
        players: 2,
        holes: 18,
        originalPrice: card.price,
        price: card.price,
        isHotDeal: card.isHotDeal,
        discount: 0,
        rating: normalizedRating,
        reviewCount: card.reviewCount,
        imageUrl: card.img || "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=400&h=250&fit=crop",
        bookingUrl,
        distanceMiles: card.distance,
        tier: classifyTier(normalizedRating, card.price),
      } as TeeTime;
    })
    .sort((a: TeeTime, b: TeeTime) => a.price - b.price);
}

function stateToAbbr(state: string): string {
  const map: Record<string, string> = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
    "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
    "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
    "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
    "Wisconsin": "WI", "Wyoming": "WY",
  };
  return map[state] || state;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
