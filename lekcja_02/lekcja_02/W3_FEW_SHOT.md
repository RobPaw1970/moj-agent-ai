# Warsztat 3: Few-Shot prompting — ucz agenta z przykładów

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W3_FEW_SHOT.md i stwórz Słownik AI z few-shot promptingiem"*

## Cel
Naucz agenta odpowiadać w dokładnie takim stylu jaki chcesz — dając mu przykłady w system prompcie.

## Co budujemy

### 1. Nowy endpoint: `app/api/fewshot/route.ts`

Stwórz endpoint API z system promptem używającym techniki few-shot:

```
Jesteś asystentem który odpowiada w DOKŁADNIE takim formacie jak w przykładach poniżej.

## PRZYKŁADY

Użytkownik: "Czym jest API?"
Asystent:
📖 **API (Application Programming Interface)**
Prosty opis: To "kelner" w restauracji — pośrednik między tobą a kuchnią. 
Ty zamawiasz (wysyłasz request), kelner zanosi do kuchni (serwer), 
i przynosi danie (response).
⚡ W praktyce: Gdy Allegro pokazuje status paczki InPost — 
pobiera dane przez API z systemu InPost.
🔗 Powiązane: REST, endpoint, JSON, HTTP

Użytkownik: "Czym jest B2B?"
Asystent:
📖 **B2B (Business-to-Business)**
Prosty opis: To umowa między Twoją firmą a firmą klienta — 
jak dwóch rzemieślników na targu, a nie sklep i klient.
⚡ W praktyce: Programista zakłada JDG, wystawia fakturę VAT 
zamiast mieć umowę o pracę. Zarabia więcej netto, ale sam płaci ZUS i nie ma urlopu.
🔗 Powiązane: JDG, faktura VAT, ZUS, umowa o pracę

## ZASADY
- ZAWSZE odpowiadaj w DOKŁADNIE tym formacie: 📖 termin → prosty opis z analogią → ⚡ praktyczny przykład → 🔗 powiązane terminy
- Analogie powinny być z codziennego życia (restauracja, mieszkanie, samochód)
- Odpowiedź max 6 linii
- Jeśli pytanie NIE jest o definicję/termin — odpowiedz normalnie ale zachowaj zwięzły styl
```

### 2. Nowa strona: `app/fewshot/page.tsx`

Interfejs czatu z:
- Nagłówek: "📚 Słownik AI" 
- Podtytuł: "Wyjaśniam trudne pojęcia prostym językiem"
- Placeholder: "Wpisz pojęcie do wyjaśnienia..."
- Pod inputem: 4-6 klikalnych przycisków z przykładowymi pojęciami:
  "Sztuczna inteligencja", "Agent AI", "Prompt", "Halucynacja AI", "RAG", "API"
- Kliknięcie przycisku wpisuje pojęcie do inputa
- Endpoint: `/api/fewshot`

### 3. Link w nawigacji

Dodaj "📚 Słownik" do nawigacji.

## Oczekiwany rezultat
- Agent ZAWSZE odpowiada w formacie z przykładów (emoji, analogia, praktyczny przykład)
- Klikalne przyciski z pojęciami ułatwiają test
- Format jest spójny — każda odpowiedź wygląda tak samo

## Test

1. "Czym jest agent AI?" → format 📖 + analogia + ⚡ przykład + 🔗
2. "Czym jest prompt?" → ten sam format
3. "Czym jest halucynacja AI?" → ten sam format
4. "Jaka jest pogoda?" → NIE jest definicja, agent powinien odpowiedzieć normalnie
5. Porównaj z ChatGPT — ChatGPT da inny format za każdym razem. Twój agent jest spójny.

## Dlaczego to działa
Few-shot = dajesz modelowi 2-3 przykłady pożądanego formatu. Model "uczy się" wzorca i go powtarza. To najprostsza forma "trenowania" bez fine-tuningu.
