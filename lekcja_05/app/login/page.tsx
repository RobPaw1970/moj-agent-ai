"use client";

import { FormEvent, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");

    const result = isRegistering
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setIsLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (isRegistering && !result.data.session) {
      setMessage("Konto utworzone. Sprawdź email i potwierdź rejestrację.");
      return;
    }

    window.location.assign("/");
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">Finora 💰</div>
        <h1>{isRegistering ? "Utwórz konto" : "Zaloguj się"}</h1>
        <p>Twoje rozmowy i profil są prywatne.</p>
        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </label>
          <label>
            Hasło
            <input autoComplete={isRegistering ? "new-password" : "current-password"} minLength={6} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </label>
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          {message ? <p className="login-success" role="status">{message}</p> : null}
          <button disabled={isLoading} type="submit">
            {isLoading ? "Proszę czekać..." : isRegistering ? "Zarejestruj się" : "Zaloguj się"}
          </button>
        </form>
        <button className="login-toggle" onClick={() => { setIsRegistering((value) => !value); setError(""); setMessage(""); }} type="button">
          {isRegistering ? "Mam już konto — logowanie" : "Nie mam konta — rejestracja"}
        </button>
      </section>
    </main>
  );
}
