import { mkdir, readFile, rename, writeFile } from "node:fs/promises";

const baseUrl = process.env.AGENT_BASE_URL ?? "http://agent-leads:3050";
const timezone = process.env.REPORT_TIMEZONE ?? "Europe/Warsaw";
const reportHour = Number(process.env.REPORT_HOUR ?? 8);
const reportMinute = Number(process.env.REPORT_MINUTE ?? 0);
const recipients = (process.env.REPORT_RECIPIENTS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
const statePath = "/app/data/last-daily-report-date";
let running = false;

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function previousDate(dateKey) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function lastSuccessfulDate() {
  try { return (await readFile(statePath, "utf8")).trim(); } catch { return ""; }
}

async function saveSuccessfulDate(dateKey) {
  await mkdir("/app/data", { recursive: true });
  const temporaryPath = `${statePath}.tmp`;
  await writeFile(temporaryPath, `${dateKey}\n`, "utf8");
  await rename(temporaryPath, statePath);
}

async function chatReport(reportDate) {
  const prompt = `Przygotuj raport leadów wyłącznie za dzień ${reportDate}. Obowiązkowo sprawdź Leadfeeder, Biznes Polska i pozostałe źródła zgodnie z definicją agenta. Wyklucz szpitale i niskie zaangażowanie. Zwróć pełne dane potrzebne do Excela.`;
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ id: `daily-${reportDate}`, role: "user", parts: [{ type: "text", text: prompt }] }] }),
  });
  if (!response.ok || !response.body) throw new Error(`Chat HTTP ${response.status}`);
  const raw = await response.text();
  const text = raw.split(/\r?\n/).filter((line) => line.startsWith("data: ")).map((line) => line.slice(6)).filter((line) => line !== "[DONE]").flatMap((line) => {
    try { const event = JSON.parse(line); return event.type === "text-delta" ? [event.delta ?? ""] : []; } catch { return []; }
  }).join("").trim();
  if (!text) throw new Error("Agent nie zwrócił tekstowego raportu");
  return text;
}

async function emailReport(reportDate, report) {
  const response = await fetch(`${baseUrl}/api/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipients,
      reports: [report],
      subject: `Leadka — leady z dnia ${reportDate}`,
      message: `W załączeniu znajduje się zweryfikowany raport leadów za ${reportDate}.`,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? `Email HTTP ${response.status}`);
}

async function tick() {
  if (running) return;
  const now = localParts();
  const dateKey = `${now.year}-${now.month}-${now.day}`;
  if (Number(now.hour) !== reportHour || Number(now.minute) !== reportMinute) return;
  if (await lastSuccessfulDate() === dateKey) return;
  if (recipients.length === 0) throw new Error("Brak REPORT_RECIPIENTS");
  running = true;
  try {
    const reportDate = previousDate(dateKey);
    console.log(`[daily-leads] Generowanie raportu za ${reportDate}`);
    const report = await chatReport(reportDate);
    await emailReport(reportDate, report);
    await saveSuccessfulDate(dateKey);
    console.log(`[daily-leads] Raport za ${reportDate} wysłany do ${recipients.length} odbiorców`);
  } catch (error) {
    console.error("[daily-leads] Błąd:", error instanceof Error ? error.message : error);
  } finally {
    running = false;
  }
}

console.log(`[daily-leads] Harmonogram aktywny: ${String(reportHour).padStart(2, "0")}:${String(reportMinute).padStart(2, "0")} ${timezone}`);
await tick();
setInterval(() => void tick(), 30_000);
