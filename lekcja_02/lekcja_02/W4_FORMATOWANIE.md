# Warsztat 4: Wymuszanie formatu — tabele, listy, markdown

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W4_FORMATOWANIE.md i dodaj komendy formatujące do mojego agenta"*

## Cel
Agent odpowiada w DOKŁADNYM formacie: tabela, lista, porównanie — na żądanie użytkownika.

## Co budujemy

### 1. Nowy endpoint: `app/api/format/route.ts`

Stwórz endpoint z system promptem wymuszającym format na podstawie komendy:

```
Jesteś asystentem który formatuje odpowiedzi według instrukcji użytkownika.

Rozpoznajesz komendy formatu na początku wiadomości:

/tabela [temat] — odpowiedz w formie tabeli markdown
  Kolumny dobierz do tematu. Minimum 3 kolumny, 5 wierszy.
  Przykład: /tabela porównanie frameworków JavaScript

/lista [temat] — odpowiedz jako lista numerowana z opisami
  Każdy punkt: numer + nagłówek (bold) + 1 zdanie opisu
  Przykład: /lista 10 zasad dobrego kodu

/porownanie [A] vs [B] — tabela porównawcza dwóch rzeczy
  Kolumny: Aspekt | [A] | [B] | Werdykt
  Minimum 6 aspektów + wiersz podsumowania
  Przykład: /porownanie React vs Vue

/faq [temat] — lista pytań i odpowiedzi
  Format: **Q:** pytanie (bold) → **A:** odpowiedź
  Minimum 5 par Q&A
  Przykład: /faq praca zdalna

/email [opis] — napisz profesjonalny email
  Format: Temat | Od/Do | Treść | Podpis
  Przykład: /email prośba o urlop na 2 tygodnie

Jeśli wiadomość NIE zaczyna się od komendy — odpowiadaj normalnie, 
ale w czystym, czytelnym markdown.

ZAWSZE formatuj w markdown (nagłówki, pogrubienia, tabele, listy).
```

### 2. Nowa strona: `app/format/page.tsx`

Interfejs czatu z:
- Nagłówek: "📐 Formatowanie"
- Podtytuł: "Agent odpowiada w tabeli, liście, porównaniu — na żądanie"
- Klikalne przyciski komend (zamiast pustego pola):
  - `/tabela języki programowania 2026`
  - `/porownanie ChatGPT vs Claude`
  - `/lista 5 kroków do pierwszego agenta AI`
  - `/faq sztuczna inteligencja dla początkujących`
  - `/email podziękowanie za udaną rekrutację`
- Kliknięcie wpisuje komendę do inputa (użytkownik może edytować przed wysłaniem)
- **WAŻNE:** Odpowiedzi powinny renderować markdown (tabele, pogrubienia, listy).
  Użyj biblioteki do renderowania markdown (np. `react-markdown`) lub 
  prostego renderowania: zamień `**text**` na `<strong>`, `|` na `<table>` itp.
- Endpoint: `/api/format`

### 3. Link w nawigacji

Dodaj "📐 Formater" do nawigacji.

## Oczekiwany rezultat
- Komendy `/tabela`, `/lista`, `/porownanie`, `/faq`, `/email` dają konkretny format
- Tabele renderują się jako HTML tabele (nie surowy markdown)
- Klikalne przyciski ułatwiają start

## Test

1. `/tabela 5 najpopularniejszych modeli AI w 2026` → tabela z kolumnami
2. `/porownanie praca zdalna vs biuro` → tabela porównawcza
3. `/faq co to jest agent AI` → 5+ pytań i odpowiedzi
4. `/email prośba o podwyżkę` → profesjonalny email
5. Normalne pytanie bez komendy → zwykła odpowiedź w markdown

## Dlaczego to jest ważne
Formatowanie to nie kosmetyka. W pracy z AI format odpowiedzi decyduje o użyteczności. Tabela którą można wkleić do Excela, email który można wysłać, FAQ na stronę — to są NARZĘDZIA, nie zabawki.
