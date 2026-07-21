import { readFileSync } from "node:fs";
import { join } from "node:path";
import { google } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";

export const runtime = "nodejs";

const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), "W10_DefinicjaAgenta.md"),
  "utf8",
);

const BIZNES_POLSKA_URL = "https://www.biznes-polska.pl";
const LEADFEEDER_API_URL = "https://api.leadfeeder.com/v1";

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cookieHeader(response: Response) {
  const raw = response.headers.get("set-cookie") ?? "";
  return raw
    .split(/,(?=[^;,]+=)/)
    .map((cookie) => cookie.split(";", 1)[0])
    .filter(Boolean)
    .join("; ");
}

function extractAnnouncements(html: string) {
  const results: Array<{ title: string; url: string }> = [];
  const seen = new Set<string>();
  const linkPattern = /<a[^>]+href=["']([^"']*\/przetargi\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const url = new URL(match[1], BIZNES_POLSKA_URL).toString();
    const title = decodeHtml(match[2]);
    if (!title || seen.has(url) || url.endsWith("/przetargi/")) continue;
    seen.add(url);
    results.push({ title, url });
    if (results.length >= 25) break;
  }
  return results;
}

const biznesPolskaSearch = tool({
  description:
    "Loguje się do autoryzowanej bazy Biznes Polska i wyszukuje aktualne przetargi oraz zapytania. Użyj obowiązkowo podczas wyszukiwania leadów ERP w Polsce.",
  inputSchema: z.object({
    queries: z
      .array(z.string().min(2))
      .min(1)
      .max(8)
      .describe("Frazy wyszukiwania, np. wdrożenie ERP, zintegrowany system informatyczny"),
  }),
  execute: async ({ queries }) => {
    const username = process.env.BIZNES_POLSKA_LOGIN;
    const password = process.env.BIZNES_POLSKA_PASSWORD;
    const checkedAt = new Date().toISOString();

    if (!username || !password) {
      return { status: "no_access", checkedAt, message: "Brak skonfigurowanych poświadczeń Biznes Polska.", results: [] };
    }

    try {
      const loginBody = new URLSearchParams({ username, password });
      const loginResponse = await fetch(`${BIZNES_POLSKA_URL}/logowanie/`, {
        method: "POST",
        body: loginBody,
        redirect: "manual",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "L-Systems AgentLeads/1.0",
        },
      });
      const cookie = cookieHeader(loginResponse);
      if (!cookie) throw new Error("Serwis nie utworzył sesji.");

      const sessionCheck = await fetch(`${BIZNES_POLSKA_URL}/`, {
        headers: { Cookie: cookie, "User-Agent": "L-Systems AgentLeads/1.0" },
        cache: "no-store",
      });
      const sessionHtml = await sessionCheck.text();
      if (!sessionHtml.includes("Jesteś zalogowany jako")) throw new Error("Nie udało się potwierdzić zalogowanej sesji.");

      const searches = [];
      for (const query of queries) {
        const body = new URLSearchParams({ search_type: "1", text: query, location: "" });
        const response = await fetch(`${BIZNES_POLSKA_URL}/wyszukiwarka/`, {
          method: "POST",
          body,
          headers: {
            Cookie: cookie,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "L-Systems AgentLeads/1.0",
          },
          cache: "no-store",
        });
        const html = await response.text();
        searches.push({ query, results: extractAnnouncements(html) });
      }

      return {
        status: "authenticated",
        checkedAt,
        source: BIZNES_POLSKA_URL,
        searches,
      };
    } catch (error) {
      return {
        status: "error",
        checkedAt,
        message: error instanceof Error ? error.message : "Nieznany błąd Biznes Polska.",
        results: [],
      };
    }
  },
});

const leadfeederEngagedVisitors = tool({
  description:
    "Pobiera z autoryzowanego API Leadfeeder firmy odwiedzające witrynę i kwalifikuje rzeczywiste zaangażowanie. Użyj obowiązkowo przy wyszukiwaniu nowych leadów. Krótkie wejście na jedną stronę nie jest aktywnym leadem.",
  inputSchema: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Początek okresu YYYY-MM-DD"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Koniec okresu YYYY-MM-DD"),
    pageSize: z.number().int().min(1).max(100).default(100),
  }),
  execute: async ({ startDate, endDate, pageSize }) => {
    const apiKey = process.env.LEADFEEDER_API_KEY;
    const accountId = process.env.LEADFEEDER_ACCOUNT_ID;
    const checkedAt = new Date().toISOString();
    if (!apiKey || !accountId) {
      return { status: "no_access", checkedAt, message: "Brak konfiguracji API Leadfeeder.", companies: [] };
    }

    try {
      const url = new URL(`${LEADFEEDER_API_URL}/web-visits`);
      url.searchParams.set("account_id", accountId);
      url.searchParams.set("include", "company");
      url.searchParams.set("page_num", "1");
      url.searchParams.set("page_size", String(pageSize));
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify({ start_date: startDate, end_date: endDate }),
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.errors?.[0]?.title ?? `Leadfeeder HTTP ${response.status}`);

      const included = new Map<string, Record<string, unknown>>(
        (payload.included ?? [])
          .filter((item: { type?: string }) => item.type === "company")
          .map((item: { id: string; attributes?: Record<string, unknown> }) => [item.id, item.attributes ?? {}]),
      );
      const grouped = new Map<string, { companyId: string; visits: number; totalSeconds: number; totalPageviews: number; lastVisit: string; pages: Set<string>; goals: boolean; company: Record<string, unknown> }>();
      for (const visit of payload.data ?? []) {
        const attributes = visit.attributes ?? {};
        const companyId = visit.relationships?.company?.id;
        if (!companyId) continue;
        const entry = grouped.get(companyId) ?? { companyId, visits: 0, totalSeconds: 0, totalPageviews: 0, lastVisit: "", pages: new Set<string>(), goals: false, company: included.get(companyId) ?? {} };
        const engagements = Array.isArray(attributes.engagements) ? attributes.engagements : [];
        entry.visits += 1;
        entry.totalSeconds += Number(attributes.visit_length ?? 0);
        entry.totalPageviews += Number(attributes.page_depth ?? engagements.filter((e: { event_type?: string }) => e.event_type === "page-view").length);
        entry.lastVisit = [entry.lastVisit, String(attributes.started_at ?? "")].sort().at(-1) ?? "";
        for (const engagement of engagements) {
          const page = engagement?.page?.url ?? engagement?.page?.path;
          if (page) entry.pages.add(String(page));
          if (engagement?.has_met_goals) entry.goals = true;
        }
        grouped.set(companyId, entry);
      }

      const companies = Array.from(grouped.values()).map((entry) => {
        const highIntentPages = Array.from(entry.pages).filter((page) => /ifs|erp|cloud|wdroż|rozwiazan|solution|service|kontakt|contact|case|pricing|ofert/i.test(page));
        const qualified = entry.goals || entry.visits >= 2 || entry.totalPageviews >= 2 || entry.totalSeconds >= 60 || highIntentPages.length > 0;
        const engagement = entry.goals || entry.totalPageviews >= 4 || entry.totalSeconds >= 180 || highIntentPages.length >= 2 ? "wysokie" : qualified ? "średnie" : "niskie";
        return { companyId: entry.companyId, company: entry.company, visits: entry.visits, totalSeconds: entry.totalSeconds, totalPageviews: entry.totalPageviews, lastVisit: entry.lastVisit, pages: Array.from(entry.pages), highIntentPages, goalsReached: entry.goals, engagement, qualified };
      });

      return {
        status: "authenticated",
        checkedAt,
        source: "https://app.leadfeeder.com/",
        period: { startDate, endDate },
        criteria: "qualified = cel, ponowna wizyta, >=2 odsłony, >=60 s lub strona wysokiej intencji",
        qualifiedCompanies: companies.filter((company) => company.qualified),
        rejectedLowEngagement: companies.filter((company) => !company.qualified),
        pagination: payload.meta?.pagination,
      };
    } catch (error) {
      return { status: "error", checkedAt, message: error instanceof Error ? error.message : "Nieznany błąd Leadfeeder.", companies: [] };
    }
  },
});

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();

  const result = streamText({
    model: google("gemini-3.5-flash"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(8),
    tools: {
      google_search: google.tools.googleSearch({}),
      biznes_polska_search: biznesPolskaSearch,
      leadfeeder_engaged_visitors: leadfeederEngagedVisitors,
    },
  });

  return result.toUIMessageStreamResponse();
}
