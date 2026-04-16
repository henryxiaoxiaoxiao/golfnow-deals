import nodemailer from "nodemailer";
import { TeeTime } from "@/types";

// In development, use a test account or configure real SMTP in .env
function getTransporter() {
  // Check if real SMTP credentials are configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback: log email to console in development
  return null;
}

export async function sendBookingEmail(
  email: string,
  teeTime: TeeTime
): Promise<{ success: boolean; message: string }> {
  const transporter = getTransporter();

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #16a34a; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">GolfNow Deals</h1>
        <p style="margin: 5px 0 0;">Your Tee Time Booking Link</p>
      </div>
      <div style="padding: 20px; background: #f9fafb;">
        <h2 style="color: #16a34a;">${teeTime.courseName}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Date & Time</td>
            <td style="padding: 8px 0; font-weight: bold;">${teeTime.displayDate} at ${teeTime.displayTime}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Price</td>
            <td style="padding: 8px 0; font-weight: bold; color: #16a34a;">
              $${teeTime.price}
              ${teeTime.isHotDeal ? ' <span style="background: #dc2626; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">HOT DEAL</span>' : ""}
              ${teeTime.discount > 0 ? ` <span style="color: #6b7280; text-decoration: line-through; font-weight: normal;">$${teeTime.originalPrice}</span> (${teeTime.discount}% off)` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Holes</td>
            <td style="padding: 8px 0; font-weight: bold;">${teeTime.holes}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Location</td>
            <td style="padding: 8px 0;">${teeTime.address}, ${teeTime.city}, ${teeTime.state}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Distance</td>
            <td style="padding: 8px 0;">${teeTime.distanceMiles} miles</td>
          </tr>
        </table>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${teeTime.bookingUrl}"
             style="display: inline-block; background: #16a34a; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Book on GolfNow
          </a>
        </div>
      </div>
      <div style="padding: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>Sent by GolfNow Deals Helper. Prices may change.</p>
      </div>
    </div>
  `;

  if (!transporter) {
    // Development mode: log instead of sending
    console.log("=== EMAIL (dev mode - not actually sent) ===");
    console.log(`To: ${email}`);
    console.log(`Subject: Tee Time at ${teeTime.courseName} - $${teeTime.price}`);
    console.log(`Booking URL: ${teeTime.bookingUrl}`);
    console.log("=============================================");
    return {
      success: true,
      message:
        "Email logged to console (no SMTP configured). Set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env to send real emails.",
    };
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: `Tee Time at ${teeTime.courseName} - $${teeTime.price}`,
      html: htmlContent,
    });
    return { success: true, message: "Booking email sent successfully!" };
  } catch (error) {
    console.error("Failed to send email:", error);
    return {
      success: false,
      message: "Failed to send email. Please try again.",
    };
  }
}
