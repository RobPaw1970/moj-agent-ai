import ExcelJS from "exceljs";

export const runtime = "nodejs";

type ExportRequest = { reports?: string[] };
type ParsedTable = { headers: string[]; rows: string[][] };
type LeadRecord = Record<string, string> & { "Pełna karta leada": string };

const HOSPITAL_PATTERN = /\b(szpital(?:e|a|em|om|ach|ny|na|ne)?|hospital|leczenie szpitalne)\b/i;

function clean(value: string) {
  return value.trim().replace(/\*\*/g, "");
}

function splitTableRow(line: string) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map(clean);
}

function extractTables(markdown: string): ParsedTable[] {
  const lines = markdown.split(/\r?\n/);
  const tables: ParsedTable[] = [];

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!lines[index].includes("|") || !/^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) continue;
    const headers = splitTableRow(lines[index]);
    const rows: string[][] = [];
    index += 2;
    while (index < lines.length && lines[index].includes("|")) {
      const row = splitTableRow(lines[index]);
      if (row.some(Boolean)) rows.push(row);
      index += 1;
    }
    if (headers.length > 1 && rows.length > 0) tables.push({ headers, rows });
  }
  return tables;
}

function splitIntoLeadCards(report: string) {
  const marker = /\*\*Nazwa firmy:\*\*/gi;
  const starts = Array.from(report.matchAll(marker), (match) => match.index ?? 0);
  if (starts.length === 0) return [report];

  return starts.map((start, index) => {
    const next = starts[index + 1] ?? report.length;
    let cardStart = report.lastIndexOf("\n##", start);
    if (cardStart < 0 || cardStart < (starts[index - 1] ?? 0)) cardStart = start;
    return report.slice(cardStart, next).trim();
  });
}

function extractLead(card: string): LeadRecord {
  const record: LeadRecord = { "Pełna karta leada": card };
  const fieldPattern = /^\s*[-*]?\s*\*\*([^*\n:]+):\*\*\s*(.*)$/gm;

  for (const match of card.matchAll(fieldPattern)) {
    const label = clean(match[1]);
    const value = clean(match[2]) || "Brak danych";
    record[label] = record[label] ? `${record[label]}\n${value}` : value;
  }

  const urls = Array.from(
    new Set(card.match(/https?:\/\/[^\s)>\]]+/g) ?? []),
  );
  if (urls.length > 0) record["Wszystkie źródła URL"] = urls.join("\n");
  return record;
}

function isHospitalLead(record: LeadRecord) {
  return [
    record["Nazwa firmy"],
    record["Branża"],
    record["Profil działalności"],
  ].some((value) => HOSPITAL_PATTERN.test(value ?? ""));
}

function setUsefulWidths(sheet: ExcelJS.Worksheet, maxWidth: number) {
  sheet.columns.forEach((column) => {
    let width = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const longestLine = String(cell.value ?? "")
        .split("\n")
        .reduce((max, line) => Math.max(max, line.length), 0);
      width = Math.max(width, Math.min(longestLine + 2, maxWidth));
    });
    column.width = width;
  });
}

export async function POST(request: Request) {
  const { reports = [] }: ExportRequest = await request.json();
  const usableReports = reports.map((report) => report.trim()).filter(Boolean);
  if (usableReports.length === 0) return Response.json({ error: "Brak danych do eksportu." }, { status: 400 });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Generator leadów IFS Cloud";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("Lista leadów", { views: [{ state: "frozen", ySplit: 1 }] });
  const parsedTables = usableReports.flatMap(extractTables);
  if (parsedTables.length > 0) {
    const headers = Array.from(new Set(parsedTables.flatMap((table) => table.headers)));
    const rows = parsedTables.flatMap((table) => table.rows.map((row) => {
      const values = new Map(table.headers.map((header, index) => [header, row[index] ?? ""]));
      return headers.map((header) => values.get(header) ?? "");
    })).filter((row) => {
      const companyIndex = headers.findIndex((header) => /firma|nazwa/i.test(header));
      const industryIndex = headers.findIndex((header) => /branża|profil/i.test(header));
      return !HOSPITAL_PATTERN.test(`${row[companyIndex] ?? ""} ${row[industryIndex] ?? ""}`);
    });
    summarySheet.addTable({
      name: "ListaLeadow", ref: "A1", headerRow: true,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: headers.map((name) => ({ name, filterButton: true })), rows,
    });
  } else {
    summarySheet.addTable({
      name: "ListaLeadow", ref: "A1", headerRow: true,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: [{ name: "Informacja", filterButton: true }],
      rows: [["W odpowiedziach nie znaleziono tabeli zbiorczej leadów."]],
    });
  }
  setUsefulWidths(summarySheet, 45);

  const leadRecords = usableReports
    .flatMap(splitIntoLeadCards)
    .map(extractLead)
    .filter((record) => !isHospitalLead(record));
  const preferred = [
    "Nazwa firmy", "NIP", "KRS", "Siedziba", "Branża", "Profil działalności",
    "Obrót", "Rok obrotu", "Liczba zatrudnionych", "Rok danych o zatrudnieniu",
    "Grupa kapitałowa", "Strona internetowa", "Źródło danych finansowych",
    "Główny sygnał zakupowy", "Data sygnału", "Obecnie używany system ERP",
    "Planowany projekt albo inwestycja", "Dlaczego firma może być zainteresowana IFS Cloud",
    "Dlaczego warto skontaktować się z firmą teraz", "Poziom pewności",
    "Leadfeeder – ID firmy", "Leadfeeder – pierwsza wizyta w okresie",
    "Leadfeeder – ostatnia wizyta", "Leadfeeder – liczba wizyt",
    "Leadfeeder – łączny czas wizyt (sekundy)", "Leadfeeder – liczba odsłon",
    "Leadfeeder – odwiedzone strony", "Leadfeeder – strony wysokiej intencji",
    "Leadfeeder – realizacja celu", "Leadfeeder – poziom zaangażowania",
    "Leadfeeder – data weryfikacji",
    "Imię i nazwisko", "Stanowisko", "Służbowy e-mail", "Status weryfikacji Hunter",
    "Telefon służbowy", "Profil LinkedIn", "Łączna liczba punktów", "Klasa",
    "Rekomendowane działanie", "Wszystkie źródła URL", "Pełna karta leada",
  ];
  const discovered = Array.from(new Set(leadRecords.flatMap((record) => Object.keys(record))));
  const headers = ["Lp.", "Data eksportu", ...preferred.filter((header) => discovered.includes(header)), ...discovered.filter((header) => !preferred.includes(header))];
  const detailsSheet = workbook.addWorksheet("Pełne dane leadów", { views: [{ state: "frozen", ySplit: 1, xSplit: 2 }] });
  detailsSheet.addTable({
    name: "PelneDaneLeadow", ref: "A1", headerRow: true,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: headers.map((name) => ({ name, filterButton: true })),
    rows: leadRecords.map((record, index) => headers.map((header) => {
      if (header === "Lp.") return index + 1;
      if (header === "Data eksportu") return new Date();
      return record[header] ?? "Brak danych";
    })),
  });
  detailsSheet.getColumn(1).width = 8;
  detailsSheet.getColumn(2).width = 20;
  detailsSheet.getColumn(2).numFmt = "yyyy-mm-dd hh:mm";
  detailsSheet.columns.forEach((column, index) => {
    if (index > 1) column.alignment = { wrapText: true, vertical: "top" };
  });
  setUsefulWidths(detailsSheet, 55);
  const fullCardColumn = headers.indexOf("Pełna karta leada") + 1;
  if (fullCardColumn > 0) detailsSheet.getColumn(fullCardColumn).width = 100;
  detailsSheet.eachRow((row, rowNumber) => { if (rowNumber > 1) row.height = 120; });

  const buffer = await workbook.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="leady-ifs-cloud-${date}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
