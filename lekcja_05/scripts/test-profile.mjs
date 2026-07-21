import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const envText = await readFile(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  envText.split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator), line.slice(separator + 1)];
  }),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const userId = randomUUID();

try {
  const { error: createError } = await supabase
    .from("user_profiles")
    .insert({ id: userId, preferences: {} });
  if (createError) throw createError;

  const { error: updateError } = await supabase
    .from("user_profiles")
    .update({ name: "Paweł", preferences: { miasto: "Kraków", zainteresowania: "góry i narty" } })
    .eq("id", userId);
  if (updateError) throw updateError;

  const { data: restored, error: readError } = await supabase
    .from("user_profiles")
    .select("id, name, preferences")
    .eq("id", userId)
    .single();
  if (readError) throw readError;
  if (restored.name !== "Paweł") throw new Error("Imię nie zostało odtworzone");
  if (restored.preferences.miasto !== "Kraków") throw new Error("Miasto nie zostało odtworzone");
  if (restored.preferences.zainteresowania !== "góry i narty") {
    throw new Error("Zainteresowania nie zostały odtworzone");
  }

  console.log("OK: utworzenie profilu z UUID");
  console.log("OK: zapis i odczyt imienia");
  console.log("OK: zapis i odczyt preferencji JSONB");
} finally {
  const { error: cleanupError } = await supabase.from("user_profiles").delete().eq("id", userId);
  if (cleanupError) throw cleanupError;
  console.log("OK: usunięcie profilu testowego");
}
