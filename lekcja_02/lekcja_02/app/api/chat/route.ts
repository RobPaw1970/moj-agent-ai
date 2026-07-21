import { NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const MODEL_MAP = {
  flash: "gemini-3.5-flash",
  pro: "gemini-3.1-pro-preview"
} as const;

type ModelKey = keyof typeof MODEL_MAP;

const SYSTEM_PROMPT = `# KadraPro - Specjalista ds. kadr i prawa pracy

## KIM JESTEM
Jestem specjalista ds. kadr i prawa pracy z 12-letnim doswiadczeniem w polskim HR.
Specjalizuje sie w czasie pracy, urlopach pracowniczych oraz dokumentacji kadrowej.
Pracowalem z malymi firmami, dzialami HR w spolkach uslugowych oraz menedzerami zatrudniajacymi pierwszych pracownikow.

## JAK ODPOWIADAM

### Struktura kazdej odpowiedzi:
1. Kontekst - potwierdzam zrozumienie pytania w 1 zdaniu.
2. Analiza - merytoryczna odpowiedz w maksymalnie 2 akapitach.
3. Rekomendacja - konkretne dzialanie do podjecia w 1-3 punktach.
4. Pytanie - jedno pytanie poglebiajace do uzytkownika.

### Zasady:
- ZANIM odpowiem na zlozone pytanie, pytam o kontekst.
- Gdy podaje fakty, oznaczam pewnosc: "✓ pewne", "~ przyblizone", "? do weryfikacji".
- Pogrubiam kluczowe terminy przy pierwszym uzyciu.
- Uzywam list numerowanych dla krokow, punktowanych dla opcji.
- Maksymalnie 3 akapity plus rekomendacja.

### Styl:
- Jezyk: polski.
- Ton: profesjonalny, ale przystepny.
- Gdy uzywam terminu branzowego, wyjasniam go w nawiasie.

## CZEGO NIE ROBIE
- Nie odpowiadam na pytania spoza kadr i prawa pracy. Mowie wprost, czego nie moge zrobic, i proponuje, w czym moge pomoc.
- Nie udaje, ze wiem cos, czego nie wiem.
- Nie udzielam indywidualnych porad prawnych. Podaje informacje ogolne i wskazuje, kiedy warto skonsultowac sie z radca prawnym lub prawnikiem prawa pracy.`;

function getRequestedModel(model: unknown): ModelKey {
  return model === "pro" ? "pro" : "flash";
}

function toGeminiRole(role: ChatMessage["role"]) {
  return role === "assistant" ? "model" : "user";
}

export async function POST(request: Request) {
  const apiKey =
    process.env.GOOGLE_AI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Brakuje klucza API. Ustaw zmienna srodowiskowa GOOGLE_GENERATIVE_AI_API_KEY."
      },
      { status: 500 }
    );
  }

  const body = await request.json();
  const messages = Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : [];
  const modelKey = getRequestedModel(body.model);
  const modelName = MODEL_MAP[modelKey];

  const contents = messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
    )
    .map((message) => ({
      role: toGeminiRole(message.role),
      parts: [{ text: message.content }]
    }));

  if (contents.length === 0) {
    return NextResponse.json(
      { error: "Wyslij przynajmniej jedna wiadomosc." },
      { status: 400 }
    );
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          temperature: modelKey === "pro" ? 0.35 : 0.55,
          topP: 0.9
        }
      })
    }
  );

  if (!response.ok) {
    const details = await response.text();

    return NextResponse.json(
      {
        error:
          response.status === 429
            ? "Przekroczono limit Google Gemini dla tego projektu. Poczekaj na odnowienie limitu albo uzyj innego projektu."
            : "Nie udalo sie pobrac odpowiedzi z Google Gemini.",
        details
      },
      { status: response.status }
    );
  }

  const data = await response.json();
  const content =
    data?.candidates?.[0]?.content?.parts
      ?.filter((part: { text?: string }) => typeof part.text === "string")
      .map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim() ?? "";

  return NextResponse.json({
    content: content || "Nie otrzymalem tresci odpowiedzi z modelu.",
    model: modelKey,
    modelName
  });
}
