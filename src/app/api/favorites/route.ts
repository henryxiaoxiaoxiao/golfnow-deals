import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get("email");
    if (!email) {
      return Response.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const favorites = db
      .prepare("SELECT * FROM favorite_courses WHERE email = ?")
      .all(email);

    return Response.json({ favorites });
  } catch (error) {
    console.error("Get favorites error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, courseId, courseName, starRating = 5 } = body;

    if (!email || !courseId || !courseName) {
      return Response.json(
        { error: "Email, courseId, and courseName are required" },
        { status: 400 }
      );
    }

    const db = getDb();
    db.prepare(
      `INSERT INTO favorite_courses (id, email, course_id, course_name, star_rating)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(email, course_id) DO UPDATE SET star_rating = ?, course_name = ?`
    ).run(uuidv4(), email, courseId, courseName, starRating, starRating, courseName);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Add favorite error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, courseId } = body;

    if (!email || !courseId) {
      return Response.json(
        { error: "Email and courseId are required" },
        { status: 400 }
      );
    }

    const db = getDb();
    db.prepare(
      "DELETE FROM favorite_courses WHERE email = ? AND course_id = ?"
    ).run(email, courseId);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete favorite error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
