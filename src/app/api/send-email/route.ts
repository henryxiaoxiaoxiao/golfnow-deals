import { NextRequest } from "next/server";
import { sendBookingEmail } from "@/lib/email";
import { TeeTime } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, teeTime } = body as { email: string; teeTime: TeeTime };

    if (!email || !teeTime) {
      return Response.json(
        { error: "Email and tee time data are required" },
        { status: 400 }
      );
    }

    const result = await sendBookingEmail(email, teeTime);
    return Response.json(result);
  } catch (error) {
    console.error("Send email error:", error);
    return Response.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
