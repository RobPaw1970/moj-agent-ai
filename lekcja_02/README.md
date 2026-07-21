# AI Agents — Warsztaty

Materiały do kursu "Budowanie Agentów AI" (Laba).

## Jak używać

1. Pobierz ten folder (ZIP)
2. Otwórz go w swoim AI coding assistant (Codex / Claude Code / Antigravity)
3. Powiedz AI: **"Przeczytaj plik lekcja_01/W1_CHATBOT.md i zbuduj to co jest opisane"**
4. Testuj, baw się, eksperymentuj

## Wymagania

- **Node.js** — [nodejs.org](https://nodejs.org) (wersja 18+)
- **Klucz API Google AI Studio** — [aistudio.google.com](https://aistudio.google.com) → Get API Key (darmowy!)
- **AI coding assistant** — jedno z:
  - Codex (GitHub)
  - Claude Code (terminal)
  - Antigravity (IDE)

**Nie potrzebujesz:** Pythona, Gita, GitHuba, VS Code.

## Struktura

```
lekcja_01/          ← Od LLM do agenta
  W0_SETUP.md       — Twój pierwszy klucz do AI (Node.js + API key)
  W1_CHATBOT.md     — Zbuduj chatbota AI od zera
  W2_PERSONA.md     — Nadaj agentowi osobowość
  W3_TRYBY.md       — Dodaj tryby rozmowy
  W4_PAMIEC.md      — Pamięć + eksport rozmowy

lekcja_02/          ← Inżynieria promptów
  W1_PERSONA_PRO.md — Profesjonalny prompt + przełącznik modeli
  W2_CHAIN_OF_THOUGHT.md — Myślenie krok po kroku
  W3_FEW_SHOT.md    — Słownik AI (few-shot prompting)
  W4_FORMATOWANIE.md — Komendy /tabela /lista /email
```

## Jak uruchomić agenta

Po zbudowaniu projektu na warsztatach:
```
cd moj-agent
npm run dev
```
Otwórz **http://localhost:3000** w przeglądarce. Gotowe.

Zatrzymanie: `Ctrl + C`. Ponowne uruchomienie: `npm run dev`.

## Zasady

- **Nie pisz kodu ręcznie** — opisz AI czego chcesz
- **Eksperymentuj** — zmień prompt, dodaj coś od siebie
- **Pytaj na czacie kursu** jeśli coś nie działa
