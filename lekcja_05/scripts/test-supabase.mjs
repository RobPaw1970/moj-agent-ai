import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const envText = await readFile(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

let conversationId;

try {
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .insert({ title: "Test W2: Cześć, mam na imię Anna" })
    .select("id, title, updated_at")
    .single();
  if (conversationError) throw conversationError;
  conversationId = conversation.id;

  const { error: messagesError } = await supabase.from("messages").insert([
    { conversation_id: conversationId, role: "user", content: "Cześć, mam na imię Anna" },
    { conversation_id: conversationId, role: "assistant", content: "Miło Cię poznać, Anno!" },
  ]);
  if (messagesError) throw messagesError;

  const updatedAt = new Date(Date.now() + 1000).toISOString();
  const { error: updateError } = await supabase
    .from("conversations")
    .update({ updated_at: updatedAt })
    .eq("id", conversationId);
  if (updateError) throw updateError;

  const { data: restored, error: readError } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (readError) throw readError;
  if (restored.length !== 2) throw new Error(`Oczekiwano 2 wiadomości, otrzymano ${restored.length}`);
  if (restored[0].role !== "user" || restored[1].role !== "assistant") {
    throw new Error("Niepoprawna kolejność lub role wiadomości");
  }

  console.log("OK: utworzenie rozmowy");
  console.log("OK: zapis wiadomości user i assistant");
  console.log("OK: odczyt historii w kolejności chronologicznej");
  console.log("OK: aktualizacja updated_at");
} finally {
  if (conversationId) {
    const { error: cleanupError } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId);
    if (cleanupError) throw cleanupError;
    console.log("OK: usunięcie danych testowych (CASCADE)");
  }
}
