# Warsztat 4: Lista rozmów — historia jak w ChatGPT

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W4_LISTA_ROZMOW.md i zbuduj stronę /history z listą moich rozmów. Klikam → widzę rozmowę. Mogę usunąć."*

## Cel
Strona `/history` z listą wszystkich rozmów użytkownika. Kliknięcie na rozmowę → podgląd. Przycisk usunięcia. Pełna historia jak sidebar w ChatGPT.

## Kontekst
W Warsztacie 2 agent zaczął zapisywać rozmowy do Supabase. W Warsztacie 3 — zapamiętał Twoje imię. Ale nie masz wglądu w historię — nie widzisz listy swoich rozmów.

Teraz budujemy stronę `/history` — pełna lista rozmów z datami, podglądem i możliwością usunięcia. Jak sidebar w ChatGPT, ale na osobnej stronie.

## Co budujemy

### 1. Strona `/history` — lista rozmów

```
Stwórz stronę app/history/page.tsx:

Nagłówek: "📜 Historia rozmów"
Podtytuł: "Wszystkie Twoje rozmowy z agentem"

Przy załadowaniu strony pobierz z Supabase:
SELECT * FROM conversations
WHERE user_id = {current_user_id}  (lub bez WHERE jeśli nie mamy jeszcze auth)
ORDER BY updated_at DESC

Dla każdej rozmowy pokaż kartę:
- Tytuł rozmowy (z tabeli conversations.title)
- Data ostatniej aktywności (np. "2 godziny temu", "wczoraj", "15 czerwca 2026")
- Liczba wiadomości (COUNT z tabeli messages WHERE conversation_id = ...)
- Podgląd ostatniej wiadomości (skrócony do 100 znaków)
- Przycisk 🗑️ Usuń (z potwierdzeniem)

Pusta lista → komunikat: "Nie masz jeszcze żadnych rozmów. Zacznij nową!"
z przyciskiem "Rozpocznij rozmowę" prowadzącym do strony czatu.
```

### 2. Podgląd rozmowy

```
Kliknięcie na kartę rozmowy → strona app/history/[id]/page.tsx:

Nagłówek: tytuł rozmowy + data
Przycisk "← Wróć do listy" (link do /history)
Przycisk "🔄 Kontynuuj rozmowę" (link do strony czatu z załadowaną rozmową)

Lista wiadomości (tylko do odczytu):
- Wiadomości usera: wyrównane prawo, tło niebieskie
- Wiadomości agenta: wyrównane lewo, tło szare
- Format: [rola] [czas] treść
- Sortowanie: od najstarszej do najnowszej (chronologicznie)
```

### 3. Usuwanie rozmowy

```
Przycisk 🗑️ przy każdej rozmowie:
1. Pokaż dialog potwierdzenia: "Czy na pewno chcesz usunąć tę rozmowę? Tej operacji nie można cofnąć."
2. Po potwierdzeniu:
   - DELETE FROM messages WHERE conversation_id = {id}
   - DELETE FROM conversations WHERE id = {id}
3. Odśwież listę (bez przeładowania strony)
4. Pokaż toast/komunikat: "Rozmowa usunięta"
```

### 4. Wyszukiwanie rozmów (bonus)

```
Pole wyszukiwania na górze strony /history:
- Placeholder: "Szukaj w rozmowach..."
- Filtrowanie: szukaj w conversations.title LUB messages.content
- Wynik: pokaż pasujące rozmowy z podświetlonym fragmentem

Jeśli to za dużo — pomiń. Wystarczy sortowanie po dacie.
```

### 5. Link w nawigacji

```
Dodaj "📜 Historia" do nawigacji (sidebar/navbar).
```

## Oczekiwany rezultat
- Strona `/history` z listą rozmów posortowaną od najnowszej
- Każda karta: tytuł, data, liczba wiadomości, podgląd
- Kliknięcie → pełny podgląd rozmowy (read-only)
- Przycisk "Kontynuuj rozmowę" → powrót do czatu z załadowaną rozmową
- Usuwanie z potwierdzeniem
- Estetyczny, ciemny motyw spójny z resztą aplikacji

## Test

1. Prowadź 3 różne rozmowy z agentem (używając przycisku "Nowa rozmowa")
2. Idź na `/history` → widzisz **3 karty** rozmów 🎉
3. Kliknij na pierwszą → widzisz wszystkie wiadomości (chronologicznie)
4. Kliknij "Wróć do listy" → wracasz na `/history`
5. Kliknij 🗑️ na jednej rozmowie → potwierdź → rozmowa znika z listy
6. Sprawdź w Supabase Dashboard → rekord usunięty z `conversations` i `messages`
7. Odśwież stronę `/history` → lista nadal poprawna (z bazy, nie z cache)

## Styl

```
Karty rozmów:
- Tło: ciemne (#1a1a2a)
- Border: subtelny (#333)
- Hover: rozjaśnienie + border akcentowy (np. cyan #61F8F8)
- Tytuł: biały, bold
- Data i liczba wiadomości: szary tekst
- Podgląd: szary, kursywa
- Przycisk usunięcia: czerwony, widoczny po najechaniu

Podgląd rozmowy:
- Bąbelki wiadomości jak na stronie czatu
- Czas przy każdej wiadomości (np. "14:32")
- Read-only — brak pola input
```

## Dlaczego to jest ważne
To jest fundament UX każdej aplikacji AI. ChatGPT ma sidebar z rozmowami. Claude ma listę konwersacji. Twój agent właśnie dostał to samo. Użytkownik widzi WSZYSTKIE swoje rozmowy, może do nich wrócić, kontynuować lub usunąć. To nie jest demo — to jest produkt.
