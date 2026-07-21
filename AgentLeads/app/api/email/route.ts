import nodemailer from "nodemailer";
import { z } from "zod";

export const runtime = "nodejs";

const requestSchema = z.object({
  recipients: z.array(z.string().email()).min(1).max(50),
  reports: z.array(z.string().min(1)).min(1),
  subject: z.string().min(1).max(200).optional(),
  message: z.string().max(5000).optional(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Nieprawidłowa lista odbiorców." }, { status: 400 });
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM ?? user;
  if (!host || !user || !password || !from) {
    return Response.json({ error: "Wysyłka nie jest skonfigurowana. Ustaw dane SMTP konta nadawcy." }, { status: 503 });
  }

  const exportResponse = await fetch(new URL("/api/export", request.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reports: parsed.data.reports }),
    cache: "no-store",
  });
  if (!exportResponse.ok) return Response.json({ error: "Nie udało się utworzyć załącznika Excel." }, { status: 500 });
  const attachment = Buffer.from(await exportResponse.arrayBuffer());
  const disposition = exportResponse.headers.get("Content-Disposition") ?? "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `Leadka_Leady_IFS_Cloud_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    requireTLS: process.env.SMTP_SECURE !== "true",
    auth: { user, pass: password },
  });
  try {
    await transporter.sendMail({
      from,
      to: parsed.data.recipients,
      subject: (parsed.data.subject ?? "Lista leadów IFS Cloud").replace(/[\r\n]+/g, " "),
      text: parsed.data.message?.trim() || "W załączeniu znajduje się aktualna lista wygenerowanych leadów IFS Cloud.",
      attachments: [{ filename, content: attachment, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }],
    });
    return Response.json({ sent: true, recipientCount: parsed.data.recipients.length });
  } catch (error) {
    console.error("Lead email delivery failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Nie udało się wysłać wiadomości. Sprawdź konfigurację konta nadawcy." }, { status: 502 });
  }
}
