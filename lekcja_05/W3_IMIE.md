# Warsztat 3: Agent zna Twoje imię — personalizacja

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W3_IMIE.md i zrób żeby agent pytał o imię przy pierwszej wizycie i zapamiętywał je w Supabase. Przy kolejnej wizycie wita po imieniu."*

## Cel
Agent rozpoznaje czy to nowy czy powracający użytkownik. Nowy → pyta o imię. Powracający → wita po imieniu. Dane przechowuje w tabeli `user_profiles` w Supabase.

## Kontekst
W Warsztacie 2 podłączyliśmy Supabase — agent zapisuje rozmowy. Ale nadal nie wie KIM jest użytkownik. Nie zna Twojego imienia, nie pamięta Twoich preferencji.

Teraz dodajemy **personalizację** — agent zapamiętuje Twoje dane w tabeli `user_profiles` i używa ich w każdej rozmowie.

## Co budujemy

### 1. Identyfikacja użytkownika

```
Na razie NIE mamy logowania (to będzie w L07).
Identyfikujemy użytkownika po unikalnym ID zapisanym w localStorage przeglądarki.

Przy pierwszej wizycie:
1. Sprawdź localStorage — czy jest klucz 'user_id'?
2. Jeśli NIE → wygeneruj nowy UUID (crypto.randomUUID())
   i zapisz w localStorage + stwórz rekord w tabeli user_profiles
3. Jeśli TAK → pobierz profil z Supabase po tym ID

To jest tymczasowe rozwiązanie — w L07 zastąpimy je prawdziwym logowaniem.
```

### 2. Logika pierwszej wizyty

```
Przy starcie strony sprawdź czy user_profiles ma rekord z imieniem:

JEŚLI profil istnieje i ma name:
  → Agent wie jak się nazywasz
  → Dodaj do system promptu: "Użytkownik ma na imię {name}. Przywitaj go po imieniu."

JEŚLI profil istnieje ale name jest puste (NULL):
  → To pierwsza wizyta lub użytkownik nie podał imienia
  → Agent powinien się przedstawić i zapytać o imię
  → Dodaj do system promptu: "To nowy użytkownik. Przedstaw się krótko i zapytaj jak ma na imię."
```

### 3. Zapisywanie imienia

```
Agent pyta: "Cześć! Jak masz na imię?"
Użytkownik odpowiada: "Mam na imię Paweł"

Mechanizm zapisywania imienia — WYBIERZ jedną z opcji:
Opcja A (prostsza): Dodaj narzędzie (tool) "saveUserName":
  - Parametr: name (string)
  - Działanie: UPDATE user_profiles SET name = {name} WHERE id = {user_id}
  - Agent wywołuje to narzędzie automatycznie gdy użytkownik poda imię

Opcja B (bez tool): Po odpowiedzi usera szukaj wzorca "mam na imię X" / "jestem X" / "nazywam się X"
  i zapisz do Supabase.

Rekomendacja: Opcja A (tool) — spójne z resztą kursu.
```

### 4. Personalizowany system prompt

```
Zmodyfikuj system prompt agenta (w API route):

JEŚLI znamy imię użytkownika:
  System prompt += "\n\nUżytkownik ma na imię {name}. 
  Zwracaj się do niego po imieniu. 
  Bądź ciepły i personalny — to Twój stały użytkownik."

JEŚLI nie znamy imienia:
  System prompt += "\n\nTo nowy użytkownik. 
  Na początku pierwszej rozmowy przywitaj się i zapytaj jak ma na imię.
  Gdy poda imię — użyj narzędzia saveUserName żeby je zapamiętać."
```

### 5. Zapisywanie preferencji (bonus)

```
Rozszerz narzędzie o saveUserPreference:
- Parametry: key (string), value (string)
- Działanie: UPDATE user_profiles SET preferences = preferences || {key: value}
  (dopisuje do JSONB, nie nadpisuje)

Przykłady:
- "Lubię pizzę" → saveUserPreference("ulubione_jedzenie", "pizza")
- "Mieszkam w Krakowie" → saveUserPreference("miasto", "Kraków")

Agent powinien używać tych informacji w rozmowie:
"Paweł, wiem że lubisz pizzę — mogę polecić włoskie restauracje w Krakowie!"
```

## Oczekiwany rezultat
- Pierwsza wizyta: agent pyta o imię → zapisuje w Supabase
- Kolejna wizyta: agent wita "Cześć, Paweł!"
- Preferencje zapisują się w JSONB — agent je pamięta
- W Supabase Dashboard widać profil użytkownika z imieniem i preferencjami

## Test

1. **Pierwsza wizyta (czysta):**
   - Wyczyść localStorage przeglądarki (DevTools → Application → Local Storage → Clear)
   - Odśwież stronę
   - Agent: "Cześć! Nie znamy się jeszcze. Jak masz na imię?"
   - Ty: "Mam na imię Paweł"
   - Agent: "Miło Cię poznać, Paweł! Czym mogę Ci pomóc?"

2. **Druga wizyta:**
   - **Zamknij przeglądarkę** (nie kartę — całą przeglądarkę!)
   - Otwórz ponownie → wejdź na stronę agenta
   - Agent: **"Cześć, Paweł! Miło Cię znowu widzieć!"** 🎉

3. **Preferencje:**
   - "Lubię góry i narty"
   - Agent zapisuje preferencję
   - Następna rozmowa: "Paweł, skoro lubisz narty, mogę sprawdzić warunki na stokach!"

4. **Sprawdź w Supabase Dashboard:**
   - Table Editor → `user_profiles` → widzisz rekord z Twoim imieniem i preferencjami

## Dlaczego to jest ważne
To jest personalizacja — fundament każdego produktu AI. ChatGPT pamięta Twoje instrukcje. Spotify pamięta Twoje gusta. Twój agent właśnie nauczył się tego samego: rozpoznaje Cię i dostosowuje się. To zmienia relację z "kolejny chatbot" na "MÓJ asystent".
