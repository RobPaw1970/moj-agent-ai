# Warsztat 1: Załóż Supabase — Twoja baza danych w chmurze

> ⚠️ **Ten warsztat jest INNY niż pozostałe!**
> Tutaj NIE wklejamy promptu do AI assistanta.
> Prowadzący pokazuje na ekranie — Ty klikasz krok po kroku.

## Cel
Założyć projekt w Supabase i stworzyć tabele, które agent będzie wykorzystywał do zapamiętywania rozmów i danych użytkownika.

## Kontekst
Po Lekcji 4 Twój agent ma 10 narzędzi, ReAct, dashboard — ale jest "amnezjakiem". Odśwież stronę → wszystko znika. Dlaczego? Bo dane żyją w RAM (pamięci przeglądarki/serwera). Gdy zamkniesz kartę — RAM się czyści.

Supabase to **baza danych w chmurze** — dane zapisane tam przetrwają zamknięcie przeglądarki, restart komputera, nawet koniec świata (no, prawie).

## Krok po kroku

### 1. Załóż konto na Supabase
- Otwórz przeglądarkę → **supabase.com**
- Kliknij **"Start your project"**
- Zaloguj się kontem **GitHub** (masz je z Lekcji 1)
- Gotowe — jesteś w Supabase Dashboard

### 2. Stwórz nowy projekt
- Kliknij **"New Project"**
- Organization: wybierz swoją (lub stwórz nową)
- Wypełnij:
  - **Name:** `moj-agent` (lub inna nazwa)
  - **Database Password:** wymyśl hasło i **ZAPISZ JE** (będziesz potrzebować)
  - **Region:** `Central EU (Frankfurt)` — najbliżej Polski
- Kliknij **"Create new project"**
- Poczekaj ~1 minutę aż projekt się stworzy

### 3. Skopiuj klucze do swojej aplikacji
- W Supabase Dashboard kliknij **Settings** (ikona zębatki) → **API**
- Skopiuj dwa klucze:
  - **Project URL** — wygląda jak `https://xxxxx.supabase.co`
  - **anon/public key** — długi ciąg znaków (zaczyna się od `eyJ...`)

- W swoim projekcie (folder z agentem) otwórz plik **`.env.local`** i dodaj:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...twój_klucz...
```

> 💡 **Masz już** `GOOGLE_GENERATIVE_AI_API_KEY` w tym pliku z Lekcji 1. Nie usuwaj go! Dopisz nowe linie pod spodem.

### 4. Stwórz tabelę `conversations` (lista rozmów)
- W Supabase Dashboard kliknij **Table Editor** (w menu po lewej)
- Kliknij **"Create a new table"**
- Name: `conversations`
- Odznacz **"Enable Row Level Security (RLS)"** (na razie — włączymy w L07)
- Kolumny (dodaj przyciskiem "Add column"):

| Nazwa kolumny | Typ | Domyślna wartość | Uwagi |
|---------------|-----|-------------------|-------|
| `id` | `uuid` | `gen_random_uuid()` | ✅ Primary Key (domyślne) |
| `created_at` | `timestamptz` | `now()` | ✅ już jest domyślnie |
| `title` | `text` | (puste) | Nazwa rozmowy |
| `updated_at` | `timestamptz` | `now()` | Ostatnia aktywność |

- Kliknij **"Save"**

### 5. Stwórz tabelę `messages` (wiadomości w rozmowach)
- Kliknij **"Create a new table"** ponownie
- Name: `messages`
- Odznacz RLS
- Kolumny:

| Nazwa kolumny | Typ | Domyślna wartość | Uwagi |
|---------------|-----|-------------------|-------|
| `id` | `uuid` | `gen_random_uuid()` | ✅ Primary Key |
| `created_at` | `timestamptz` | `now()` | |
| `conversation_id` | `uuid` | (puste) | Powiąże z tabelą conversations |
| `role` | `text` | (puste) | `user` lub `assistant` |
| `content` | `text` | (puste) | Treść wiadomości |

- Kliknij **"Save"**

### 6. Stwórz tabelę `user_profiles` (profil użytkownika)
- Kliknij **"Create a new table"** ponownie
- Name: `user_profiles`
- Odznacz RLS
- Kolumny:

| Nazwa kolumny | Typ | Domyślna wartość | Uwagi |
|---------------|-----|-------------------|-------|
| `id` | `uuid` | `gen_random_uuid()` | ✅ Primary Key |
| `created_at` | `timestamptz` | `now()` | |
| `name` | `text` | (puste) | Imię użytkownika |
| `preferences` | `jsonb` | `{}` | Preferencje (ulubione jedzenie, miasto, itp.) |

- Kliknij **"Save"**

### 7. Sprawdź czy tabele istnieją
- W Table Editor powinieneś widzieć 3 tabele: `conversations`, `messages`, `user_profiles`
- Kliknij na każdą — powinna być pusta (0 rows), z poprawnymi kolumnami

## Oczekiwany rezultat
- ✅ Konto na Supabase
- ✅ Projekt `moj-agent` w regionie Frankfurt
- ✅ Klucze `SUPABASE_URL` i `SUPABASE_ANON_KEY` w `.env.local`
- ✅ 3 tabele: `conversations`, `messages`, `user_profiles`
- ✅ Tabele puste, gotowe na dane

## Typowe problemy

| Problem | Rozwiązanie |
|---------|-------------|
| "Nie mogę się zalogować do Supabase" | Zaloguj się kontem GitHub — to samo które masz z Lekcji 1 |
| "Nie widzę przycisku New Project" | Musisz najpierw stworzyć Organization → potem projekt |
| "Zapomniałem hasła do bazy" | Settings → Database → kliknij "Reset database password" |
| "Nie wiem gdzie jest anon key" | Settings → API → Project API keys → sekcja "anon public" |

## Dlaczego to jest ważne
Właśnie stworzyłeś **bazę danych w chmurze** — za darmo. To ta sama technologia, której używają firmy do przechowywania danych milionów użytkowników. Twój agent za chwilę będzie zapisywał rozmowy tak, jak robi to ChatGPT.
