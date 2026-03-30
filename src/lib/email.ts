import nodemailer from "nodemailer";
import QRCode from "qrcode";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendQREmail(
  email: string,
  eventLabel: string | null,
  eventDate: Date,
  checkInId: string
): Promise<boolean> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://www.sundai.club";
  const checkInUrl = `${baseUrl}/admin/checkin/scan?token=${checkInId}`;

  const qrDataUrl = await QRCode.toDataURL(checkInUrl, {
    width: 300,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");

  const dateStr = eventDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const label = eventLabel || "Sundai Club Event";

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "Sundai Club <noreply@sundai.club>",
    to: email,
    subject: `Your QR Code for ${label} - ${dateStr}`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111; font-size: 24px; margin-bottom: 8px;">${label}</h1>
        <p style="color: #555; font-size: 16px; margin-bottom: 24px;">${dateStr}</p>
        <p style="color: #333; font-size: 14px; margin-bottom: 16px;">
          Please present this QR code at the event for check-in:
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <img src="cid:qrcode" alt="Check-in QR Code" style="width: 250px; height: 250px;" />
        </div>
        <p style="color: #888; font-size: 12px; text-align: center;">
          Sundai Club
        </p>
      </div>
    `,
    attachments: [
      {
        filename: "qr-code.png",
        content: qrBuffer,
        cid: "qrcode",
      },
    ],
  });

  return true;
}
