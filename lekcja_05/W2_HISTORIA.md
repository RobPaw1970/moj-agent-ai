# Warsztat 2: Agent zapisuje rozmowy — pamięć trwała

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W2_HISTORIA.md i podłącz Supabase do mojej apki. Agent ma zapisywać rozmowy i wczytywać je po odświeżeniu strony."*

## Cel
Podłączyć Supabase do aplikacji Next.js, żeby agent zapisywał każdą rozmowę do bazy danych. Po odświeżeniu strony — rozmowy nadal są.

## Kontekst
W Warsztacie 1 stworzyliśmy projekt Supabase z tabelami `conversations`, `messages` i `user_profiles`. Klucze API są w `.env.local`. Teraz podłączamy bazę do apki.

Aktualnie agent trzyma wiadomości w pamięci przeglądarki (hook `useChat`). Gdy odświeżysz stronę — wszystko znika. Po tym warsztacie odświeżenie strony nie usunie rozmów.

## Co budujemy

### 1. Zainstaluj Supabase client

```
Zainstaluj paczkę: @supabase/supabase-js

Stwórz plik lib/supabase.ts:
- Zaimportuj createClient z @supabase/supabase-js
- Użyj NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_ANON_KEY z process.env
- Wyeksportuj gotowego klienta Supabase
```

### 2. Zapisywanie rozmów do bazy

```
Zmodyfikuj główną stronę czatu (np. app/page.tsx lub app/chat/page.tsx):

Kiedy użytkownik rozpoczyna NOWĄ rozmowę:
1. Stwórz rekord w tabeli 'conversations' z tytułem = pierwsze słowa wiadomości (max 50 znaków)
2. Zapamiętaj conversation_id

Kiedy przychodzi NOWA wiadomość (user lub assistant):
1. Zapisz do tabeli 'messages':
   - conversation_id (powiązanie z rozmową)
   - role ("user" lub "assistant")
   - content (treść wiadomości)

Zrób to w tle — nie blokuj interfejsu (np. w useEffect lub callbacku onFinish).
```

### 3. Wczytywanie rozmów po odświeżeniu

```
Przy starcie strony (useEffect mount):
1. Pobierz ostatnią aktywną rozmowę z tabeli conversations (ORDER BY updated_at DESC LIMIT 1)
2. Pobierz wszystkie messages dla tej rozmowy (ORDER BY created_at ASC)
3. Załaduj je do stanu czatu — użytkownik widzi poprzednie wiadomości

Pokaż loading spinner podczas ładowania rozmowy z bazy.
```

### 4. Aktualizacja tytułu rozmowy

```
Tytuł rozmowy = pierwsza wiadomość usera, skrócona do 50 znaków.
Np. "Zaplanuj mi weekend w Krakowie" → tytuł: "Zaplanuj mi weekend w Krakowie"
Np. "Cześć! Chciałbym się dowiedzieć jak zbudować aplikację mobilną w React Native krok po kroku z przykładami" → tytuł: "Cześć! Chciałbym się dowiedzieć jak zbudować..."

Aktualizuj pole updated_at w tabeli conversations przy KAŻDEJ nowej wiadomości.
```

### 5. Przycisk "Nowa rozmowa"

```
Dodaj przycisk "+ Nowa rozmowa" w nagłówku lub sidebarze.
Kliknięcie:
1. Czyści aktualny chat
2. Tworzy nowy rekord w tabeli conversations
3. Ustawia nowy conversation_id
```

## Oczekiwany rezultat
- Wiadomości zapisują się do Supabase w tle (bez opóźnień w UI)
- Po odświeżeniu strony (F5) — rozmowa jest nadal widoczna
- Przycisk "Nowa rozmowa" rozpoczyna czystą sesję
- W Supabase Dashboard (Table Editor) widać zapisane wiadomości

## Test

1. Napisz do agenta: "Cześć, mam na imię Anna"
2. Agent odpowiada
3. **Odśwież stronę (F5)** → Rozmowa nadal jest! 🎉
4. Idź do Supabase Dashboard → Table Editor → `messages` → widzisz zapisane wiadomości
5. Kliknij "+ Nowa rozmowa" → czysty chat → napisz coś nowego
6. Odśwież → widzisz NOWĄ rozmowę (nie starą)

## Sprawdź w Supabase Dashboard
Po teście w Table Editor powinieneś widzieć:
- `conversations` → 1-2 rekordy (tyle ile zacząłeś rozmów)
- `messages` → kilka rekordów z rolami "user" i "assistant"

## Dlaczego to jest ważne
To jest fundamentalna różnica między prototypem a produktem. ChatGPT, Claude, Gemini — wszystkie zapisują rozmowy. Twój agent właśnie dostał tę samą supermocy. Dane żyją w chmurze — nawet jeśli zamkniesz laptopa, jutro otworzysz i rozmowa będzie czekać.
