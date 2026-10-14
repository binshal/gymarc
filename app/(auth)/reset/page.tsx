"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetPage() {
  const [username, setUsername] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, recoveryCode, newPassword }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    router.push("/login");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <form onSubmit={handleReset} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-extrabold text-center mb-6">Reset password</h1>
        <input
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-mono tracking-widest"
          placeholder="6-digit recovery code"
          value={recoveryCode}
          onChange={(e) => setRecoveryCode(e.target.value)}
          maxLength={6}
        />
        <input
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm"
          placeholder="New password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        {error && <p className="text-xs text-acc">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-acc text-white font-bold rounded-xl py-3 text-sm disabled:opacity-50"
        >
          {loading ? "Resetting…" : "Reset password"}
        </button>
      </form>
    </main>
  );
}
