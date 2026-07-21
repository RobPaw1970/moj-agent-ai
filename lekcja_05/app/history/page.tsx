"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Conversation = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

type SavedMessage = {
  id: string;
  conversation_id: string;
  content: string;
  created_at: string;
};

type ConversationCard = Conversation & {
  messageCount: number;
  preview: string;
  searchableContent: string;
};

function formatActivity(dateValue: string) {
  const date = new Date(dateValue);
  const difference = Date.now() - date.getTime();
  const minutes = Math.floor(difference / 60_000);
  const hours = Math.floor(difference / 3_600_000);
  const days = Math.floor(difference / 86_400_000);
  if (minutes < 1) return "przed chwilą";
  if (minutes < 60) return `${minutes} min temu`;
  if (hours < 24) return `${hours} godz. temu`;
  if (days === 1) return "wczoraj";
  return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export default function HistoryPage() {
  const [conversations, setConversations] = useState<ConversationCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadConversations() {
    setIsLoading(true);
    setError("");
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setIsLoading(false);
      return;
    }

    const conversationResult = await supabase
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", authData.user.id)
      .order("updated_at", { ascending: false });

    const conversationIds = (conversationResult.data ?? []).map((conversation) => conversation.id);
    const messageResult = conversationIds.length > 0
      ? await supabase
          .from("messages")
          .select("id, conversation_id, content, created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: true })
      : { data: [], error: null };

    if (conversationResult.error || messageResult.error) {
      setError("Nie udało się pobrać historii rozmów.");
      setIsLoading(false);
      return;
    }

    const messages = (messageResult.data ?? []) as SavedMessage[];
    const cards = ((conversationResult.data ?? []) as Conversation[]).map((conversation) => {
      const conversationMessages = messages.filter((message) => message.conversation_id === conversation.id);
      const lastMessage = conversationMessages.at(-1)?.content ?? "Brak wiadomości";
      return {
        ...conversation,
        messageCount: conversationMessages.length,
        preview: lastMessage.length <= 100 ? lastMessage : `${lastMessage.slice(0, 97)}...`,
        searchableContent: conversationMessages.map((message) => message.content).join(" ").toLocaleLowerCase("pl"),
      };
    });
    setConversations(cards);
    setIsLoading(false);
  }

  useEffect(() => {
    void loadConversations();
  }, []);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pl");
    if (!normalizedQuery) return conversations;
    return conversations.filter((conversation) =>
      (conversation.title ?? "").toLocaleLowerCase("pl").includes(normalizedQuery) ||
      conversation.searchableContent.includes(normalizedQuery),
    );
  }, [conversations, query]);

  async function deleteConversation(id: string) {
    const confirmed = window.confirm("Czy na pewno chcesz usunąć tę rozmowę? Tej operacji nie można cofnąć.");
    if (!confirmed) return;

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;
    const { error: messagesError } = await supabase.from("messages").delete().eq("conversation_id", id);
    const { error: conversationError } = messagesError
      ? { error: messagesError }
      : await supabase.from("conversations").delete().eq("id", id).eq("user_id", authData.user.id);

    if (messagesError || conversationError) {
      setError("Nie udało się usunąć rozmowy.");
      return;
    }

    setConversations((current) => current.filter((conversation) => conversation.id !== id));
    setNotice("Rozmowa usunięta");
    window.setTimeout(() => setNotice(""), 2500);
  }

  return (
    <main className="history-shell">
      <section className="history-panel">
        <nav className="history-nav"><a href="/">← Wróć do czatu</a></nav>
        <header className="history-header">
          <h1>📜 Historia rozmów</h1>
          <p>Wszystkie Twoje rozmowy z agentem</p>
        </header>
        <input
          className="history-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Szukaj w rozmowach..."
          type="search"
          value={query}
        />
        {notice ? <div className="history-toast" role="status">{notice}</div> : null}
        {error ? <p className="history-error">{error}</p> : null}
        {isLoading ? (
          <div className="history-loading"><span className="spinner" />Wczytywanie historii...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="history-empty">
            <p>{query ? "Brak rozmów pasujących do wyszukiwania." : "Nie masz jeszcze żadnych rozmów. Zacznij nową!"}</p>
            {!query ? <a className="primary-link" href="/">Rozpocznij rozmowę</a> : null}
          </div>
        ) : (
          <div className="conversation-list">
            {filteredConversations.map((conversation) => (
              <article className="conversation-card" key={conversation.id}>
                <a className="conversation-card-link" href={`/history/${conversation.id}`}>
                  <h2>{conversation.title || "Rozmowa bez tytułu"}</h2>
                  <p className="conversation-meta">{formatActivity(conversation.updated_at)} · {conversation.messageCount} wiadomości</p>
                  <p className="conversation-preview">{conversation.preview}</p>
                </a>
                <button
                  aria-label={`Usuń rozmowę ${conversation.title || "bez tytułu"}`}
                  className="delete-conversation"
                  onClick={() => void deleteConversation(conversation.id)}
                  type="button"
                >
                  🗑 Usuń
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
