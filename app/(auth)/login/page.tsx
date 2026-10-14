"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = supabaseBrowser();
    const email = `${username.trim().toLowerCase()}@gymarc.internal`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError("Wrong username or password.");
    router.push("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-extrabold text-center mb-6">
          Gym<span className="text-acc">Arc</span>
        </h1>
        <input
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-xs text-acc">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-acc text-white font-bold rounded-xl py-3 text-sm disabled:opacity-50"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
        <div className="flex justify-between text-xs text-zinc-500">
          <a href="/signup" className="hover:text-zinc-300">Create account</a>
          <a href="/reset" className="hover:text-zinc-300">Forgot password?</a>
        </div>
      </form>
    </main>
  );
}
