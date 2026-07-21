"use client";

import type { User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user);
      setIsLoading(false);
      if (!data.user && !isLoginPage) router.replace("/login");
      if (data.user && isLoginPage) router.replace("/");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setIsLoading(false);
      if (!session?.user && !isLoginPage) router.replace("/login");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [isLoginPage, router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (isLoading) {
    return <main className="auth-loading"><span className="spinner" />Sprawdzanie sesji...</main>;
  }

  if (isLoginPage) return user ? null : children;
  if (!user) return null;

  return (
    <>
      <div className="session-bar">
        <span>{user.email}</span>
        <button onClick={() => void signOut()} type="button">Wyloguj</button>
      </div>
      {children}
    </>
  );
}
