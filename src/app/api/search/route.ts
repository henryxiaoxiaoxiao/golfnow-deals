import { NextRequest } from "next/server";
import { generateMockTeeTimes } from "@/lib/mock-data";
import { zipToCoords } from "@/lib/geo";
import { scrapeGolfNow } from "@/lib/scrape";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

export const maxDuration = 60;

const CACHE_DIR = path.join(process.cwd(), "data", "cache");
const CACHE_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

function readCache(zipCode: string, radiusMiles: number) {
  try {
    const file = path.join(CACHE_DIR, `${zipCode}.json`);
    if (!fs.existsSync(file)) return null;

    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    const age = Date.now() - new Date(data.scrapedAt).getTime();

    if (age > CACHE_MAX_AGE_MS) {
      console.log(`Cache for ${zipCode} expired (${Math.round(age / 60000)}min old)`);
      return null;
    }

    const cachedRadius = data.radiusMiles ?? 25;
    if (radiusMiles > cachedRadius) {
      console.log(`Cache for ${zipCode} was scraped at ${cachedRadius}mi, need ${radiusMiles}mi — re-scraping`);
      return null;
    }

    console.log(`Using cached data for ${zipCode} (${Math.round(age / 60000)}min old, ${data.teeTimes.length} results, scraped @${cachedRadius}mi)`);
    return data.teeTimes;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, zipCode, radiusMiles = 25 } = body;

    if (!email || !zipCode) {
      return Response.json(
        { error: "Email and zip code are required" },
        { status: 400 }
      );
    }

    if (!/^\d{5}$/.test(zipCode)) {
      return Response.json(
        { error: "Zip code must be 5 digits" },
        { status: 400 }
      );
    }

    // Try cached real data first, then live-scrape, then fall back to mock
    let teeTimes = readCache(zipCode, radiusMiles);
    let source = "cache";
    let note: string | undefined;

    if (!teeTimes) {
      const coords = await zipToCoords(zipCode);
      if (!coords) {
        return Response.json(
          { error: `Could not find location for zip code ${zipCode}` },
          { status: 400 }
        );
      }

      console.log(`No cache for ${zipCode} (${coords.city}, ${coords.state}), scraping live...`);
      const scraped = await scrapeGolfNow(zipCode, radiusMiles, coords);

      if (scraped && scraped.length > 0) {
        console.log(`Scraped ${scraped.length} real courses for ${zipCode}`);
        teeTimes = scraped;
        source = "live";
      } else {
        console.log(`Scrape failed for ${zipCode}, falling back to mock`);
        teeTimes = generateMockTeeTimes(zipCode, radiusMiles, coords);
        source = "mock";
        note = `Live data unavailable for ${coords.city}, ${coords.state} right now — showing sample listings.`;
      }
    }

    // Filter by requested radius (cache/scrape may include courses slightly beyond)
    teeTimes = teeTimes.filter(
      (t: { distanceMiles: number }) => t.distanceMiles <= radiusMiles
    );

    // Save search to database
    try {
      const db = getDb();
      db.prepare(
        `INSERT INTO search_history (id, email, zip_code, radius_miles, results_count)
         VALUES (?, ?, ?, ?, ?)`
      ).run(uuidv4(), email, zipCode, radiusMiles, teeTimes.length);

      db.prepare(
        `INSERT INTO user_preferences (id, email, zip_code, radius_miles)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET zip_code = ?, radius_miles = ?`
      ).run(uuidv4(), email, zipCode, radiusMiles, zipCode, radiusMiles);
    } catch (dbError) {
      console.error("DB write error:", dbError);
    }

    return Response.json({
      teeTimes,
      total: teeTimes.length,
      source,
      note,
      searchParams: { email, zipCode, radiusMiles },
    });
  } catch (error) {
    console.error("Search error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
