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

const THINK_SYSTEM_PROMPT = `Jestes analitykiem. Twoim zadaniem jest pokazac uporzadkowany tok analizy krok po kroku przed odpowiedzia.

Gdy dostajesz pytanie, przejdz przez te kroki:

### 🧠 MYŚLĘ...

**Krok 1 - Zrozumienie:**
Co dokladnie uzytkownik pyta? Przeformuluj pytanie swoimi slowami.

**Krok 2 - Fakty:**
Co wiadomo na ten temat? Co jest pewne, a co wymaga sprawdzenia?

**Krok 3 - Analiza:**
Jakie sa 2-3 mozliwe podejscia albo odpowiedzi?

**Krok 4 - Ocena:**
Ktore podejscie jest najlepsze? Dlaczego?

### ✅ ODPOWIEDŹ
Podaj finalna, konkretna odpowiedz na podstawie analizy powyzej.

WAZNE:
- Zawsze pokaz uzytkownikowi jawne kroki analizy: Zrozumienie, Fakty, Analiza, Ocena, Odpowiedz.
- Uzywaj naglowkow markdown do oddzielenia krokow.
- Sekcja "Mysle" powinna byc dluzsza niz finalna odpowiedz.
- Nie ujawniaj prywatnych ukrytych rozumowan modelu. Zamiast tego pokaz przejrzyste, uzyteczne uzasadnienie i obliczenia, ktore uzytkownik moze sprawdzic.`;

function getRequestedModel(model: unknown): ModelKey {
  return model === "pro" ? "pro" : "flash";
}

function toGeminiRole(role: ChatMessage["role"]) {
  return role === "assistant" ? "model" : "user";
}

function extractText(payload: unknown) {
  const parts =
    (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
      ?.candidates?.[0]?.content?.parts ?? [];

  return parts.map((part) => part.text ?? "").join("");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
          "Brakuje klucza API. Ustaw zmienna srodowiskowa GOOGLE_AI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY albo GEMINI_API_KEY."
      },
      { status: 500 }
    );
  }

  const body = await request.json();
  const messages = Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : [];
  const modelKey = getRequestedModel(body.model);
  const modelName = MODEL_MAP[modelKey];
  const fallbackModels =
    modelKey === "pro"
      ? [modelName, MODEL_MAP.flash, "gemini-2.5-flash-lite"]
      : [modelName, "gemini-2.5-flash-lite"];
  let usedModelName: string = modelName;

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

  async function callGemini(targetModel: string) {
    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: THINK_SYSTEM_PROMPT }]
          },
          contents,
          generationConfig: {
            temperature: modelKey === "pro" ? 0.35 : 0.5,
            topP: 0.9
          }
        })
      }
    );
  }

  let upstream = await callGemini(usedModelName);

  for (let attempt = 0; upstream.status === 503 && attempt < 2; attempt += 1) {
    await wait(800 * (attempt + 1));
    upstream = await callGemini(usedModelName);
  }

  for (const fallbackModel of fallbackModels.slice(1)) {
    if (upstream.status !== 503) {
      break;
    }

    usedModelName = fallbackModel;
    upstream = await callGemini(usedModelName);

    for (let attempt = 0; upstream.status === 503 && attempt < 1; attempt += 1) {
      await wait(800);
      upstream = await callGemini(usedModelName);
    }
  }

  if (!upstream.ok || !upstream.body) {
    const details = await upstream.text();
    let message = "Nie udalo sie pobrac odpowiedzi z Google Gemini.";

    if (upstream.status === 429) {
      message =
        "Limit Google Gemini zostal przekroczony dla aktualnego klucza lub modelu.";
    }

    if (upstream.status === 503) {
      message =
        "Google Gemini jest chwilowo niedostepny lub przeciazony. Sprobuj ponownie za moment.";
    }

    return NextResponse.json(
      {
        error: message,
        details
      },
      { status: upstream.status }
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed.startsWith("data:")) {
            continue;
          }

          const json = trimmed.slice(5).trim();

          if (!json || json === "[DONE]") {
            continue;
          }

          try {
            const text = extractText(JSON.parse(json));

            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          } catch {
            continue;
          }
        }
      }

      const finalLine = buffer.trim();

      if (finalLine.startsWith("data:")) {
        try {
          const text = extractText(JSON.parse(finalLine.slice(5).trim()));

          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        } catch {
          // Ignore malformed trailing chunks from the upstream stream.
        }
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Model": usedModelName
    }
  });
}
