"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Conversation = { id: string; title: string | null; created_at: string; updated_at: string };
type Message = { id: string; role: "user" | "assistant"; content: string; created_at: string };

export default function ConversationPreviewPage() {
  const params = useParams<{ id: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadConversation() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      const conversationResult = await supabase
        .from("conversations")
        .select("id, title, created_at, updated_at")
        .eq("id", params.id)
        .eq("user_id", authData.user.id)
        .maybeSingle();
      const messageResult = conversationResult.data
        ? await supabase.from("messages").select("id, role, content, created_at").eq("conversation_id", params.id).order("created_at", { ascending: true })
        : { data: [], error: null };
      if (cancelled) return;
      if (conversationResult.error || messageResult.error || !conversationResult.data) {
        setError("Nie znaleziono rozmowy lub nie udało się jej pobrać.");
      } else {
        setConversation(conversationResult.data as Conversation);
        setMessages((messageResult.data ?? []) as Message[]);
      }
      setIsLoading(false);
    }
    void loadConversation();
    return () => { cancelled = true; };
  }, [params.id]);

  return (
    <main className="history-shell">
      <section className="history-panel preview-panel">
        <nav className="preview-actions">
          <a href="/history">← Wróć do listy</a>
          {conversation ? <a className="primary-link" href={`/?conversation=${conversation.id}`}>🔄 Kontynuuj rozmowę</a> : null}
        </nav>
        {isLoading ? (
          <div className="history-loading"><span className="spinner" />Wczytywanie rozmowy...</div>
        ) : error ? (
          <p className="history-error">{error}</p>
        ) : conversation ? (
          <>
            <header className="preview-header">
              <h1>{conversation.title || "Rozmowa bez tytułu"}</h1>
              <p>{new Intl.DateTimeFormat("pl-PL", { dateStyle: "long", timeStyle: "short" }).format(new Date(conversation.updated_at))}</p>
            </header>
            <div className="preview-messages">
              {messages.map((message) => (
                <article className={`preview-message ${message.role}`} key={message.id}>
                  <div className="preview-message-meta">
                    <strong>{message.role === "user" ? "Ty" : "Finora"}</strong>
                    <time>{new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.created_at))}</time>
                  </div>
                  <p>{message.content}</p>
                </article>
              ))}
              {messages.length === 0 ? <p className="empty-state">Ta rozmowa nie ma jeszcze wiadomości.</p> : null}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
