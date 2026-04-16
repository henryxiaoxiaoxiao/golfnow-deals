import { NextRequest } from "next/server";
import { generateMockTeeTimes } from "@/lib/mock-data";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "data", "cache");
const CACHE_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

function readCache(zipCode: string) {
  try {
    const file = path.join(CACHE_DIR, `${zipCode}.json`);
    if (!fs.existsSync(file)) return null;

    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    const age = Date.now() - new Date(data.scrapedAt).getTime();

    if (age > CACHE_MAX_AGE_MS) {
      console.log(`Cache for ${zipCode} expired (${Math.round(age / 60000)}min old)`);
      return null;
    }

    console.log(`Using cached data for ${zipCode} (${Math.round(age / 60000)}min old, ${data.teeTimes.length} results)`);
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

    // Try cached real data first, then fall back to mock
    let teeTimes = readCache(zipCode);
    let source = "cache";

    if (!teeTimes) {
      console.log(`No cache for ${zipCode}, using mock data. Run: node scripts/scrape.mjs ${zipCode} ${radiusMiles}`);
      teeTimes = generateMockTeeTimes(zipCode, radiusMiles);
      source = "mock";
    }

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
