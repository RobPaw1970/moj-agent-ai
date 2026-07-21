# Warsztat 2: Chain of Thought — myślenie krok po kroku

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W2_CHAIN_OF_THOUGHT.md i dodaj tryb głębokiego myślenia do mojego agenta"*

## Cel
Dodaj tryb "głębokiego myślenia" gdzie agent pokazuje tok rozumowania przed odpowiedzią.

## Co budujemy

### 1. Nowy endpoint: `app/api/think/route.ts`

Stwórz nowy endpoint API identyczny do `/api/chat` ale z innym system promptem:

```
Jesteś analitykiem. Twoim zadaniem jest MYŚLEĆ NA GŁOS.

Gdy dostajesz pytanie, MUSISZ przejść przez te kroki:

### 🧠 MYŚLĘ...

**Krok 1 — Zrozumienie:**
Co dokładnie użytkownik pyta? Przeformułuj pytanie swoimi słowami.

**Krok 2 — Fakty:**
Co wiem na ten temat? Co jest pewne, a co wymaga sprawdzenia?

**Krok 3 — Analiza:**
Jakie są 2-3 możliwe podejścia/odpowiedzi?

**Krok 4 — Ocena:**
Które podejście jest najlepsze? DLACZEGO?

### ✅ ODPOWIEDŹ
Podaj finalną, konkretną odpowiedź na podstawie analizy powyżej.

WAŻNE:
- ZAWSZE pokaż CAŁY proces myślenia — użytkownik widzi jak pracujesz
- Używaj nagłówków markdown do oddzielenia kroków
- Krok "Myślę" powinien być DŁUŻSZY niż finalna odpowiedź
```

Endpoint powinien:
- Przyjmować te same parametry co `/api/chat` (messages)
- Używać tego samego providera Google (Gemini)
- Streamować odpowiedź

### 2. Nowa strona: `app/think/page.tsx`

Stwórz stronę z interfejsem czatu ale:
- Nagłówek: "🧠 Tryb głębokiego myślenia"
- Podtytuł: "Agent pokazuje tok rozumowania krok po kroku"
- Placeholder w input: "Zadaj trudne pytanie..."
- Endpoint: `/api/think` zamiast `/api/chat`
- Ten sam styl co strona główna

### 3. Link w nawigacji

Jeśli istnieje nawigacja/sidebar — dodaj link "🧠 Myślenie" prowadzący do `/think`.

Jeśli nie ma nawigacji — dodaj prosty pasek nawigacyjny na górze z linkami:
- 🤖 Chat (`/`)
- 🧠 Myślenie (`/think`)

## Oczekiwany rezultat
- Nowa strona `/think` z interfejsem czatu
- Agent pokazuje pełen tok rozumowania przed odpowiedzią
- Widać kroki: Zrozumienie → Fakty → Analiza → Ocena → Odpowiedź
- Link w nawigacji

## Test porównawczy

Zadaj to samo pytanie na `/` (zwykły chat) i na `/think`:

**Pytanie:** "Firma ma 120 pracowników na umowę o pracę. 40% to kobiety. Spośród kobiet 25% pracuje zdalnie. Spośród mężczyzn 15% pracuje zdalnie. Ile osób łącznie pracuje zdalnie i jaki to procent całej firmy?"

- Zwykły chat → prawdopodobnie da odpowiedź od razu (może błędną)
- /think → pokaże obliczenia krok po kroku i da poprawny wynik

**Drugie pytanie:** "Mam ofertę: 12 000 zł brutto na UoP vs 15 000 zł netto na B2B. Co się bardziej opłaca?"
- Zwykły chat → ogólna rada
- /think → rozważy ZUS, podatek, urlop, L4, koszty księgowej i da wyważoną odpowiedź
