"use client";

import { useChat } from "@ai-sdk/react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { supabase } from "../lib/supabase";

const MODES = {
  casual: { label: "Casual", icon: "💬", badge: "💬 casual" },
  ekspert: { label: "Ekspert", icon: "🎓", badge: "🎓 ekspert" },
  kreatywny: { label: "Kreatywny", icon: "🎨", badge: "🎨 kreatywny" },
} as const;

type ChatMode = keyof typeof MODES;

type UserProfile = {
  id: string;
  name: string | null;
  preferences: Record<string, string>;
};

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function createConversationTitle(text: string) {
  const normalized = text.trim().replace(/\s+/g, " ");
  return normalized.length <= 50 ? normalized : `${normalized.slice(0, 47)}...`;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ChatMode>("casual");
  const [copied, setCopied] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [, refreshModeBadges] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const pendingModeRef = useRef<ChatMode>("casual");
  const messageModesRef = useRef<Record<string, ChatMode>>({});
  const conversationIdRef = useRef<string | null>(null);
  const conversationPromiseRef = useRef<Promise<string | null> | null>(null);
  const needsTitleRef = useRef(false);
  const persistedMessageIdsRef = useRef(new Set<string>());
  const savingMessageIdsRef = useRef(new Set<string>());
  const { messages, sendMessage, setMessages, status, error, clearError } = useChat();

  const isLoading = status === "submitted" || status === "streaming";
  const visibleMessages = useMemo(
    () => messages.filter((message) => getMessageText(message).trim() !== ""),
    [messages],
  );
  const conversationText = useMemo(
    () =>
      visibleMessages
        .map((message) => `${message.role === "user" ? "User" : "Agent"}: ${getMessageText(message)}`)
        .join("\n"),
    [visibleMessages],
  );
  const estimatedTokens = Math.ceil(conversationText.length / 4);

  useEffect(() => {
    let cancelled = false;

    async function loadUserProfile() {
      let userId = localStorage.getItem("user_id");
      if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem("user_id", userId);
      }

      const { data: existingProfile, error: selectError } = await supabase
        .from("user_profiles")
        .select("id, name, preferences")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;
      if (selectError) {
        console.error("Nie udało się pobrać profilu:", selectError);
        setIsProfileLoading(false);
        return;
      }

      if (existingProfile) {
        setUserProfile({
          id: existingProfile.id,
          name: existingProfile.name,
          preferences: existingProfile.preferences ?? {},
        });
        setIsProfileLoading(false);
        return;
      }

      const { data: createdProfile, error: insertError } = await supabase
        .from("user_profiles")
        .insert({ id: userId, preferences: {} })
        .select("id, name, preferences")
        .single();

      if (cancelled) return;
      if (insertError) {
        console.error("Nie udało się utworzyć profilu:", insertError);
      } else {
        setUserProfile({
          id: createdProfile.id,
          name: createdProfile.name,
          preferences: createdProfile.preferences ?? {},
        });
      }
      setIsProfileLoading(false);
    }

    void loadUserProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLatestConversation() {
      const requestedConversationId = new URLSearchParams(window.location.search).get("conversation");
      const conversationQuery = supabase.from("conversations").select("id");
      const { data: conversation, error: conversationError } = requestedConversationId
        ? await conversationQuery.eq("id", requestedConversationId).maybeSingle()
        : await conversationQuery.order("updated_at", { ascending: false }).limit(1).maybeSingle();

      if (cancelled) return;
      if (conversationError) {
        console.error("Nie udało się pobrać rozmowy:", conversationError);
        setIsHistoryLoading(false);
        return;
      }
      if (!conversation) {
        setIsHistoryLoading(false);
        return;
      }

      const { data: savedMessages, error: messagesError } = await supabase
        .from("messages")
        .select("id, role, content")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (messagesError) {
        console.error("Nie udało się pobrać wiadomości:", messagesError);
        setIsHistoryLoading(false);
        return;
      }

      const restoredMessages: UIMessage[] = (savedMessages ?? []).map((message) => ({
        id: message.id,
        role: message.role === "assistant" ? "assistant" : "user",
        parts: [{ type: "text", text: message.content }],
      }));

      persistedMessageIdsRef.current = new Set(restoredMessages.map((message) => message.id));
      conversationIdRef.current = conversation.id;
      setConversationId(conversation.id);
      setMessages(restoredMessages);
      setIsHistoryLoading(false);
    }

    void loadLatestConversation();
    return () => {
      cancelled = true;
    };
  }, [setMessages]);

  async function ensureConversation(firstMessage?: string) {
    if (conversationIdRef.current) {
      if (firstMessage && needsTitleRef.current) {
        needsTitleRef.current = false;
        void supabase
          .from("conversations")
          .update({
            title: createConversationTitle(firstMessage),
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversationIdRef.current);
      }
      return conversationIdRef.current;
    }

    if (conversationPromiseRef.current) {
      const pendingConversationId = await conversationPromiseRef.current;
      if (pendingConversationId && firstMessage && needsTitleRef.current) {
        needsTitleRef.current = false;
        void supabase
          .from("conversations")
          .update({
            title: createConversationTitle(firstMessage),
            updated_at: new Date().toISOString(),
          })
          .eq("id", pendingConversationId);
      }
      return pendingConversationId;
    }

    if (!conversationPromiseRef.current) {
      const title = firstMessage ? createConversationTitle(firstMessage) : "Nowa rozmowa";
      conversationPromiseRef.current = (async () => {
        const { data, error: insertError } = await supabase
          .from("conversations")
          .insert({ title })
          .select("id")
          .single();

          if (insertError) {
            console.error("Nie udało się utworzyć rozmowy:", insertError);
            return null;
          }
          conversationIdRef.current = data.id;
          setConversationId(data.id);
          return data.id;
      })().finally(() => {
        conversationPromiseRef.current = null;
      });
    }
    return conversationPromiseRef.current;
  }

  useEffect(() => {
    if (isHistoryLoading || !conversationId) return;

    for (const message of messages) {
      if (message.role !== "user" && message.role !== "assistant") continue;
      if (message.role === "assistant" && status !== "ready") continue;
      if (
        persistedMessageIdsRef.current.has(message.id) ||
        savingMessageIdsRef.current.has(message.id)
      ) continue;

      const content = getMessageText(message).trim();
      if (!content) continue;

      savingMessageIdsRef.current.add(message.id);
      void (async () => {
        try {
          const { error: insertError } = await supabase
            .from("messages")
            .insert({ conversation_id: conversationId, role: message.role, content });

          if (insertError) {
            console.error("Nie udało się zapisać wiadomości:", insertError);
            return;
          }
          persistedMessageIdsRef.current.add(message.id);
          const { error: updateError } = await supabase
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversationId);
          if (updateError) console.error("Nie udało się zaktualizować rozmowy:", updateError);
        } finally {
          savingMessageIdsRef.current.delete(message.id);
        }
      })();
    }
  }, [conversationId, isHistoryLoading, messages, status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    let changed = false;
    for (const message of messages) {
      if (message.role === "assistant" && !messageModesRef.current[message.id]) {
        messageModesRef.current[message.id] = pendingModeRef.current;
        changed = true;
      }
    }
    if (changed) refreshModeBadges((value) => value + 1);
  }, [messages]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading || isHistoryLoading || isProfileLoading) return;
    clearError();
    rememberUserDetails(text);
    void ensureConversation(text);
    pendingModeRef.current = mode;
    sendMessage({ text }, { body: { mode, userProfile } });
    setInput("");
  }

  function rememberUserDetails(text: string) {
    if (!userProfile) return;

    const nameMatch = text.match(/(?:mam na imi[eę]|nazywam si[eę]|jestem)\s+([\p{L}-]{2,40})/iu);
    if (nameMatch) {
      const name = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
      setUserProfile((current) => current ? { ...current, name } : current);
      void supabase.from("user_profiles").update({ name }).eq("id", userProfile.id);
    }

    const preferenceUpdates: Record<string, string> = {};
    const cityMatch = text.match(/mieszkam w\s+([\p{L} -]{2,50})/iu);
    const likesMatch = text.match(/lubi[eę]\s+(.{2,100})/iu);
    if (cityMatch) preferenceUpdates.miasto = cityMatch[1].trim();
    if (likesMatch) preferenceUpdates.zainteresowania = likesMatch[1].trim();

    if (Object.keys(preferenceUpdates).length > 0) {
      const preferences = { ...userProfile.preferences, ...preferenceUpdates };
      setUserProfile((current) => current ? { ...current, preferences } : current);
      void supabase.from("user_profiles").update({ preferences }).eq("id", userProfile.id);
    }
  }

  function handleNewConversation() {
    messageModesRef.current = {};
    persistedMessageIdsRef.current = new Set();
    savingMessageIdsRef.current = new Set();
    conversationIdRef.current = null;
    setConversationId(null);
    needsTitleRef.current = true;
    pendingModeRef.current = mode;
    setCopied(false);
    clearError();
    setMessages([]);
    refreshModeBadges((value) => value + 1);
    void ensureConversation();
  }

  async function handleExportConversation() {
    if (!conversationText) return;
    await navigator.clipboard.writeText(conversationText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Czat z agentem Finora">
        <header className="chat-header">
          <div className="header-navigation">
            <h1>Finora 💰</h1>
            <a href="/history">📜 Historia</a>
          </div>
          <p className="agent-description">Doradca podatkowy od PIT, VAT, ryczałtu i działalności B2B w Polsce.</p>
        </header>

        <details className="memory-panel" open>
          <summary>
            <span>Kontekst rozmowy</span>
            <span>Wiadomości: {visibleMessages.length} | ~Tokeny: {estimatedTokens}</span>
          </summary>
          <div className="memory-actions">
            <button disabled={isLoading || isHistoryLoading || isProfileLoading} onClick={handleNewConversation} type="button">
              ＋ Nowa rozmowa
            </button>
            <button disabled={visibleMessages.length === 0} onClick={handleExportConversation} type="button">
              📋 Eksportuj rozmowę
            </button>
            {copied ? <span className="copy-confirmation">Skopiowano!</span> : null}
          </div>
        </details>

        <div className="messages">
          {isHistoryLoading || isProfileLoading ? (
            <div className="history-loading" role="status">
              <span className="spinner" aria-hidden="true" />
              Wczytywanie profilu i rozmowy...
            </div>
          ) : (
            <>
              <div className="message-row assistant">
                <div className="message assistant welcome-message">
                  {userProfile?.name
                    ? `Cześć, ${userProfile.name}! Miło Cię znowu widzieć. W czym mogę Ci pomóc?`
                    : "Cześć! Jestem Finora. Nie znamy się jeszcze — jak masz na imię?"}
                </div>
              </div>
              {visibleMessages.length === 0 ? (
                <p className="empty-state">Zapytaj o podatki, rozliczenia, koszty firmowe albo prowadzenie B2B.</p>
              ) : visibleMessages.map((message) => {
              const text = getMessageText(message);
              const role = message.role === "user" ? "user" : "assistant";
              const messageMode = role === "assistant" ? messageModesRef.current[message.id] ?? mode : undefined;
              return (
                <div className={`message-row ${role}`} key={message.id}>
                  <div className={`message ${role}`}>
                    {messageMode ? <span className={`mode-badge ${messageMode}`}>{MODES[messageMode].badge}</span> : null}
                    {text}
                  </div>
                </div>
              );
              })}
            </>
          )}

          {isLoading ? (
            <div className="message-row assistant">
              <div className="message assistant thinking">
                <span className={`mode-badge ${pendingModeRef.current}`}>{MODES[pendingModeRef.current].badge}</span>
                Myślę...
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="message-row assistant">
              <div className="message assistant error-message">
                <span className="mode-badge casual">błąd</span>
                {error.message.includes("quota") || error.message.includes("limit")
                  ? "Gemini przekroczył chwilowy limit zapytań. Odczekaj kilkanaście sekund i spróbuj ponownie."
                  : error.message}
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div className="mode-bar" aria-label="Tryb rozmowy">
          {(Object.entries(MODES) as Array<[ChatMode, (typeof MODES)[ChatMode]]>).map(([modeKey, modeConfig]) => (
            <button
              className={`mode-button ${modeKey} ${mode === modeKey ? "active" : ""}`}
              disabled={isLoading || isHistoryLoading || isProfileLoading}
              key={modeKey}
              onClick={() => setMode(modeKey)}
              type="button"
            >
              <span aria-hidden="true">{modeConfig.icon}</span>{modeConfig.label}
            </button>
          ))}
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <input
            aria-label="Wiadomość"
            autoComplete="off"
            disabled={isLoading || isHistoryLoading || isProfileLoading}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Napisz wiadomość..."
            value={input}
          />
          <button disabled={isLoading || isHistoryLoading || isProfileLoading || input.trim().length === 0} type="submit">Wyślij</button>
        </form>
      </section>
    </main>
  );
}
