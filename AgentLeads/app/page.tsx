"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";

function messageText(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

export default function Home() {
  const [input, setInput] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [recipients, setRecipients] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState("");
  const { messages, sendMessage, status, error } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLoading = status === "submitted" || status === "streaming";
  const assistantReports = messages
    .filter((message) => message.role === "assistant")
    .map((message) => messageText(message.parts))
    .filter(Boolean);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();

    if (!text || isLoading) return;

    setInput("");
    setExportError("");
    await sendMessage({ text });
  }

  async function exportToExcel() {
    if (assistantReports.length === 0 || isExporting) return;

    setIsExporting(true);
    setExportError("");

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reports: assistantReports }),
      });

      if (!response.ok) throw new Error("Eksport nie powiódł się.");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "leady-ifs-cloud.xlsx";
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Nie udało się utworzyć pliku Excel. Spróbuj ponownie.");
    } finally {
      setIsExporting(false);
    }
  }

  async function sendByEmail() {
    if (assistantReports.length === 0 || isSending) return;
    const addressList = Array.from(new Set(recipients.split(/[;,\s]+/).map((item) => item.trim()).filter(Boolean)));
    if (addressList.length === 0) {
      setSendStatus("Podaj co najmniej jeden adres e-mail.");
      return;
    }
    setIsSending(true);
    setSendStatus("");
    try {
      const response = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: addressList, reports: assistantReports }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Nie udało się wysłać wiadomości.");
      setSendStatus(`Wysłano wiadomość do ${result.recipientCount} odbiorców.`);
    } catch (sendError) {
      setSendStatus(sendError instanceof Error ? sendError.message : "Nie udało się wysłać wiadomości.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="chat-shell">
      <section className="chat-card" aria-label="Generator leadów">
        <header className="chat-header">
          <div className="brand">
            <div className="logo" aria-hidden="true">🤖</div>
            <div>
              <h1>Generator leadów</h1>
              <p>Asystent sprzedaży IFS Cloud</p>
            </div>
          </div>
          <button
            className="export-button"
            type="button"
            onClick={exportToExcel}
            disabled={assistantReports.length === 0 || isExporting || isLoading}
            title="Pobierz pełną listę leadów w formacie Excel"
          >
            <span aria-hidden="true">▦</span>
            {isExporting ? "Tworzę..." : "Eksportuj Excel"}
          </button>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 && (
            <div className="welcome">
              <span aria-hidden="true">✨</span>
              <h2>Jak mogę Ci pomóc?</h2>
              <p>Zadaj pytanie lub poproś o wsparcie w generowaniu leadów.</p>
            </div>
          )}

          {messages.map((message) => {
            const text = messageText(message.parts);
            if (!text) return null;

            return (
              <div key={message.id} className={`message-row ${message.role}`}>
                <div className="message-bubble">{text}</div>
              </div>
            );
          })}

          {status === "submitted" && (
            <div className="message-row assistant">
              <div className="message-bubble thinking">
                <span /><span /><span />
                <span className="thinking-label">Myślę...</span>
              </div>
            </div>
          )}

          {(error || exportError) && (
            <div className="error-message" role="alert">
              {exportError || "Nie udało się uzyskać odpowiedzi. Spróbuj ponownie."}
            </div>
          )}
          {sendStatus && <div className="send-status" role="status">{sendStatus}</div>}
          <div ref={messagesEndRef} />
        </div>

        <div className="email-panel">
          <label htmlFor="recipient-list">Odbiorcy raportu (oddziel adresy przecinkiem, średnikiem lub spacją)</label>
          <div className="email-controls">
            <input id="recipient-list" type="text" value={recipients} onChange={(event) => setRecipients(event.target.value)} placeholder="anna@firma.pl; jan@firma.pl" disabled={isSending} />
            <button type="button" onClick={sendByEmail} disabled={!recipients.trim() || assistantReports.length === 0 || isSending || isLoading}>
              {isSending ? "Wysyłam..." : "Wyślij Excel e-mailem"}
            </button>
          </div>
        </div>
        <form className="composer" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="message-input">Wiadomość</label>
          <input
            id="message-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Napisz wiadomość..."
            autoComplete="off"
            disabled={isLoading}
          />
          <button type="submit" disabled={!input.trim() || isLoading}>
            Wyślij <span aria-hidden="true">↑</span>
          </button>
        </form>
      </section>
    </main>
  );
}
