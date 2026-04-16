import { NextRequest } from "next/server";
import { generateMockTeeTimes } from "@/lib/mock-data";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

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

    // Generate mock tee times (will be replaced with real GolfNow API later)
    const teeTimes = generateMockTeeTimes(zipCode, radiusMiles);

    // Save search to database
    try {
      const db = getDb();
      db.prepare(
        `INSERT INTO search_history (id, email, zip_code, radius_miles, results_count)
         VALUES (?, ?, ?, ?, ?)`
      ).run(uuidv4(), email, zipCode, radiusMiles, teeTimes.length);

      // Upsert user preference
      db.prepare(
        `INSERT INTO user_preferences (id, email, zip_code, radius_miles)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET zip_code = ?, radius_miles = ?`
      ).run(uuidv4(), email, zipCode, radiusMiles, zipCode, radiusMiles);
    } catch (dbError) {
      // Don't fail the request if DB write fails
      console.error("DB write error:", dbError);
    }

    return Response.json({
      teeTimes,
      total: teeTimes.length,
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
