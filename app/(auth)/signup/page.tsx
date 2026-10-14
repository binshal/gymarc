"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    setRecoveryCode(data.recoveryCode);
  }

  if (recoveryCode) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-bold">Save your recovery code</h1>
          <p className="text-sm text-zinc-400">
            This is the only way to reset your password. There's no email —
            write it down or screenshot it now.
          </p>
          <div className="bg-zinc-900 border border-acc/40 rounded-2xl py-6 text-3xl font-mono font-bold tracking-widest text-acc">
            {recoveryCode}
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-400 justify-center">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            I've saved this code somewhere safe
          </label>
          <button
            disabled={!confirmed}
            onClick={() => router.push("/login")}
            className="w-full bg-acc text-white font-bold rounded-xl py-3 text-sm disabled:opacity-40"
          >
            Continue to login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <form onSubmit={handleSignup} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-extrabold text-center mb-6">Create account</h1>
        <input
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm"
          placeholder="Choose a username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm"
          placeholder="Choose a password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-xs text-acc">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-acc text-white font-bold rounded-xl py-3 text-sm disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
        <p className="text-xs text-zinc-500 text-center">
          <a href="/login" className="hover:text-zinc-300">Already have an account?</a>
        </p>
      </form>
    </main>
  );
}
