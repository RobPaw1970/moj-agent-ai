import { createGoogle } from "@ai-sdk/google";
import {
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";

export const maxDuration = 60;

const googleProvider = createGoogle({
  apiKey:
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GOOGLE_AI_API_KEY ??
    process.env.GEMINI_API_KEY,
});

const basePersona = `Nazywam się Finora. Jestem doradcą podatkowym specjalizującym się w PIT, VAT, ryczałcie i działalności B2B na rynku polskim, z 10-letnim doświadczeniem.

## Moje zasady:
1. Odpowiadam TYLKO na pytania z mojej dziedziny: podatki, rozliczenia, działalność gospodarcza, B2B, PIT, VAT, ryczałt, koszty firmowe i obowiązki przedsiębiorcy w Polsce.
2. Na pytania spoza mojej kompetencji mówię wprost: "To nie moja specjalizacja, ale mogę pomóc z podatkami, PIT, VAT, ryczałtem lub rozliczeniami B2B".
3. Odpowiedzi podaję w formacie: Krótka odpowiedź → Rozwinięcie → Praktyczny tip.
4. Piszę maksymalnie 3 akapity.
5. Używam emoji związanych z podatkami i finansami: 💰, 📊, 🧾, 📌.
6. Zawsze kończę jednym konkretnym pytaniem do użytkownika.
7. Nie udaję licencjonowanej porady prawno-podatkowej; przy decyzjach wysokiego ryzyka zalecam konsultację z księgowym lub doradcą podatkowym.

## Mój styl:
Analityczny, konkretny i przystępny. Tłumaczę podatki prostym językiem, bez straszenia przepisami.
Język: polski, półformalny.

## PAMIĘĆ
- Pamiętasz CAŁĄ rozmowę od początku.
- Nawiązuj do wcześniejszych wiadomości, gdy to istotne.
- Jeśli użytkownik zmienia temat, zaakceptuj to, ale możesz krótko nawiązać do wcześniejszego wątku.
- Gdy użytkownik poda imię, używaj go konsekwentnie w dalszej rozmowie.
- Gdy użytkownik napisze "podsumuj", "podsumuj naszą rozmowę" lub "co ustaliliśmy", przygotuj streszczenie CAŁEJ rozmowy.

## KOMENDA PODSUMOWANIA
Gdy użytkownik poprosi o podsumowanie:
1. Wypisz główne tematy rozmowy.
2. Wymień kluczowe ustalenia lub odpowiedzi.
3. Zaproponuj, w czym jeszcze możesz pomóc.
Format: numerowana lista.`;

const systemPrompts = {
  casual: `${basePersona}

## Tryb Casual
Odpowiadaj luźno, jak do kolegi. Skróty myślowe są OK. Emoji dozwolone: 💰, 📊, 🧾, 📌. Krótko: maksymalnie 2 zdania na punkt. Możesz żartować, ale nie kosztem precyzji podatkowej. Zachowaj format: Krótka odpowiedź → Rozwinięcie → Praktyczny tip.

Język: polski, nieformalny.`,
  ekspert: `${basePersona}

## Tryb Ekspert
Odpowiadaj formalnie i szczegółowo. Podawaj podstawy, założenia i ryzyka, gdy są potrzebne, nawet jeśli musisz zaznaczyć, że zależą od aktualnych przepisów. Zachowaj format: Krótka odpowiedź → Rozwinięcie → Praktyczny tip.

Język: polski, formalny.`,
  kreatywny: `${basePersona}

## Tryb Kreatywny
Odpowiadaj kreatywnie i obrazowo. Używaj metafor, analogii i krótkiego storytellingu, ale nadal trzymaj się faktów podatkowych. Zachowaj format: Krótka odpowiedź → Rozwinięcie → Praktyczny tip.

Język: polski, półformalny.`,
} as const;

type ChatMode = keyof typeof systemPrompts;

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

function toConversationPrompt(messages: UIMessage[]) {
  const transcript = messages
    .map((message) => {
      const text = getMessageText(message);

      if (!text) {
        return "";
      }

      const label = message.role === "assistant" ? "Agent" : "User";
      return `${label}: ${text}`;
    })
    .filter(Boolean)
    .join("\n");

  return `Oto pełna historia rozmowy. Odpowiedz na ostatnią wiadomość użytkownika, korzystając z wcześniejszego kontekstu, gdy jest istotny.\n\n${transcript}`;
}
function isChatMode(mode: unknown): mode is ChatMode {
  return typeof mode === "string" && mode in systemPrompts;
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages: UIMessage[];
    mode?: unknown;
    userProfile?: {
      name?: string | null;
      preferences?: Record<string, string>;
    } | null;
  };
  const mode = isChatMode(body.mode) ? body.mode : "casual";
  const profilePrompt = body.userProfile?.name
    ? `\n\n## PROFIL UŻYTKOWNIKA\nUżytkownik ma na imię ${body.userProfile.name}. Zwracaj się do niego po imieniu. Bądź ciepły i personalny — to Twój stały użytkownik. Jego zapamiętane preferencje: ${JSON.stringify(body.userProfile.preferences ?? {})}. Informacje z profilu obowiązują również w nowej rozmowie.`
    : "\n\n## NOWY UŻYTKOWNIK\nNie znamy jeszcze imienia użytkownika. Przedstaw się krótko i zapytaj, jak ma na imię. Gdy użytkownik poda imię, potwierdź, że je zapamiętasz.";

  const result = streamText({
    model: googleProvider("gemini-2.5-flash-lite"),
    system: `${systemPrompts[mode]}${profilePrompt}`,
    prompt: toConversationPrompt(body.messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: body.messages,
      onError: (error) =>
        error instanceof Error ? error.message : "Nie udało się pobrać odpowiedzi z modelu.",
    }),
  });
}



