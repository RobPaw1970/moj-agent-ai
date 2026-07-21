"use client";

import { FormEvent, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const starterQuestions = [
  "Firma ma 120 pracownikow. 40% to kobiety. Wsrod kobiet 25% pracuje zdalnie, a wsrod mezczyzn 15%. Ile osob pracuje zdalnie?",
  "Mam oferte: 12 000 zl brutto na UoP vs 15 000 zl netto na B2B. Co sie bardziej oplaca?",
  "Jak policzyc koszt nadgodzin przy stalej pensji miesiecznej?",
  "Czy lepiej zatrudnic pierwsza osobe na UoP, zlecenie czy B2B?"
];

export default function ThinkPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(messageText: string) {
    const trimmed = messageText.trim();

    if (!trimmed || isLoading) {
      return;
    }

    setError("");
    setInput("");
    setIsLoading(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed
    };
    const assistantId = crypto.randomUUID();
    const nextMessages = [...messages, userMessage];

    setMessages([
      ...nextMessages,
      {
        id: assistantId,
        role: "assistant",
        content: ""
      }
    ]);

    try {
      const response = await fetch("/api/think", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content }))
        })
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        const details =
          typeof data.details === "string" && data.details.includes("quota")
            ? " Sprawdz limit lub billing w Google AI Studio."
            : "";
        throw new Error(
          `${data.error ?? "Nie udalo sie wyslac wiadomosci."}${details}`
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });

        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { ...message, content: message.content + chunk }
              : message
          )
        );
      }
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Wystapil nieznany blad.";

      setError(message);
      setMessages((current) =>
        current.map((chatMessage) =>
          chatMessage.id === assistantId && !chatMessage.content
            ? {
                ...chatMessage,
                content: message
              }
            : chatMessage
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <main className="page">
      <div className="shell">
        <header className="header">
          <nav className="nav" aria-label="Glowne widoki">
            <a className="nav-link" href="/">
              🤖 Chat
            </a>
            <a className="nav-link active" href="/think">
              🧠 Myslenie
            </a>
          </nav>
          <p className="eyebrow">Analiza krok po kroku</p>
          <h1>🧠 Tryb glebokiego myslenia</h1>
          <p className="lead">
            Agent pokazuje tok rozumowania krok po kroku.
          </p>
          <div className="starter-row" aria-label="Przykladowe pytania">
            {starterQuestions.map((question) => (
              <button
                className="starter"
                key={question}
                onClick={() => void sendMessage(question)}
                type="button"
              >
                {question}
              </button>
            ))}
          </div>
        </header>

        <section className="chat" aria-label="Czat w trybie glebokiego myslenia">
          <div className="toolbar">
            <div className="status" aria-live="polite">
              {isLoading
                ? "Agent analizuje i strumieniuje odpowiedz..."
                : "Endpoint /api/think, model Flash domyslnie"}
            </div>
          </div>

          <div className="messages">
            {messages.length === 0 ? (
              <div className="empty-state">
                Zadaj pytanie wymagajace obliczen, porownania albo decyzji. Ten
                tryb najpierw pokaze kroki analizy, a potem finalna odpowiedz.
              </div>
            ) : (
              messages.map((message) => (
                <article className={`message ${message.role}`} key={message.id}>
                  <div className="meta">
                    {message.role === "user" ? "Ty" : "KadraPro Think"}
                    {message.role === "assistant" ? (
                      <span className="badge pro">stream</span>
                    ) : null}
                  </div>
                  {message.content || "Analizuje..."}
                </article>
              ))
            )}
          </div>

          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              aria-label="Wiadomosc"
              onChange={(event) => setInput(event.target.value)}
              placeholder="Zadaj trudne pytanie..."
              value={input}
            />
            <button className="send" disabled={isLoading || !input.trim()} type="submit">
              Wyslij
            </button>
          </form>
        </section>

        {error ? <p className="error">{error}</p> : null}
      </div>
    </main>
  );
}
