"use client";

import { FormEvent, useMemo, useState } from "react";

type ModelKey = "flash" | "pro";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: ModelKey;
  modelName?: string;
};

const starterQuestions = [
  "Ile dni urlopu przysluguje na umowie o prace?",
  "Jak rozliczyc nadgodziny pracownika?",
  "Co musi zawierac informacja o warunkach zatrudnienia?",
  "Kiedy trzeba skierowac pracownika na badania okresowe?"
];

const modelLabels: Record<ModelKey, string> = {
  flash: "Flash",
  pro: "Pro"
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<ModelKey>("flash");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const status = useMemo(() => {
    if (isLoading) {
      return `Odpowiada ${modelLabels[model]}...`;
    }

    return model === "flash"
      ? "Tryb szybki do codziennych pytan"
      : "Tryb zaawansowany do zlozonych analiz";
  }, [isLoading, model]);

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
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: nextMessages.map(({ role, content }) => ({ role, content }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Nie udalo sie wyslac wiadomosci.");
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.content,
          model: data.model,
          modelName: data.modelName
        }
      ]);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Wystapil nieznany blad.";
      setError(message);
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
            <a className="nav-link active" href="/">
              🤖 Chat
            </a>
            <a className="nav-link" href="/think">
              🧠 Myslenie
            </a>
          </nav>
          <p className="eyebrow">Profesjonalny agent AI</p>
          <h1>KadraPro - Specjalista ds. kadr i prawa pracy</h1>
          <p className="lead">
            Ekspert od kadr i prawa pracy. Zapytaj mnie o urlopy, czas pracy,
            nadgodziny, dokumentacje pracownicza i podstawowe obowiazki
            pracodawcy.
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

        <section className="chat" aria-label="Czat z agentem KadraPro">
          <div className="toolbar">
            <div className="model-toggle" aria-label="Przelacznik modelu AI">
              <button
                className={`model-button flash ${model === "flash" ? "active" : ""}`}
                onClick={() => setModel("flash")}
                type="button"
              >
                ⚡ Flash
              </button>
              <button
                className={`model-button pro ${model === "pro" ? "active" : ""}`}
                onClick={() => setModel("pro")}
                type="button"
              >
                🧠 Pro
              </button>
            </div>
            <div className="status" aria-live="polite">
              {status}
            </div>
          </div>

          <div className="messages">
            {messages.length === 0 ? (
              <div className="empty-state">
                Wybierz tryb modelu i zadaj pytanie. Agent odpowie w czterech
                sekcjach: kontekst, analiza, rekomendacja i pytanie
                poglebiajace.
              </div>
            ) : (
              messages.map((message) => (
                <article className={`message ${message.role}`} key={message.id}>
                  <div className="meta">
                    {message.role === "user" ? "Ty" : "KadraPro"}
                    {message.role === "assistant" && message.model ? (
                      <span className={`badge ${message.model}`}>
                        {message.modelName ?? modelLabels[message.model]}
                      </span>
                    ) : null}
                  </div>
                  {message.content}
                </article>
              ))
            )}
          </div>

          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              aria-label="Wiadomosc"
              onChange={(event) => setInput(event.target.value)}
              placeholder="Napisz pytanie o kadry lub prawo pracy..."
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
