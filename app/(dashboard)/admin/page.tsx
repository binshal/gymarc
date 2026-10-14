"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AdminUser = {
  id: string;
  username: string;
  recovery_code: string;
  is_admin: boolean;
  created_at: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [meId, setMeId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch("/api/admin/users");
    if (res.status === 403) { setDenied(true); setLoading(false); return; }
    const data = await res.json();
    setUsers(data.users ?? []);
    setMeId(data.meId ?? "");
    setLoading(false);
  }

  async function act(body: Record<string, unknown>, success: string) {
    setMessage("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error ?? "Something went wrong."); return false; }
    setMessage(success);
    await load();
    return true;
  }

  function changeCode(u: AdminUser) {
    const input = prompt(`New 6-digit code for ${u.username}\n(leave empty to generate a random one)`, "");
    if (input === null) return;
    act({ action: "setCode", userId: u.id, code: input.trim() }, `Recovery code updated for ${u.username}.`);
  }

  function changePassword(u: AdminUser) {
    const input = prompt(`New password for ${u.username}`);
    if (!input) return;
    act({ action: "setPassword", userId: u.id, password: input }, `Password changed for ${u.username}.`);
  }

  function toggleAdmin(u: AdminUser) {
    act({ action: "setAdmin", userId: u.id, isAdmin: !u.is_admin },
      `${u.username} is ${u.is_admin ? "no longer" : "now"} an admin.`);
  }

  function deleteUser(u: AdminUser) {
    if (!confirm(`Delete ${u.username} and ALL their data? This can't be undone.`)) return;
    act({ action: "delete", userId: u.id }, `${u.username} deleted.`);
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  if (denied) {
    return (
      <div className="max-w-md mx-auto space-y-3">
        <p className="text-sm text-zinc-400">This page is for admins only.</p>
        <button onClick={() => router.push("/")} className="text-xs text-acc">← Back home</button>
      </div>
    );
  }

  const filtered = users.filter((u) => u.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-md mx-auto md:max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="text-zinc-500 text-sm">←</button>
        <h1 className="font-bold text-lg">Admin</h1>
        <span className="text-[10px] text-zinc-500 ml-auto">{users.length} users</span>
      </div>

      <input
        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm"
        placeholder="Search username"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {message && (
        <p className="text-xs text-acc2 bg-acc2/10 border border-acc2/30 rounded-xl px-3 py-2">{message}</p>
      )}

      <div className="space-y-3">
        {filtered.map((u) => (
          <div key={u.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold">
                  {u.username}
                  {u.is_admin && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded-full bg-acc/15 text-acc">admin</span>}
                  {u.id === meId && <span className="ml-1 text-[9px] text-zinc-500">(you)</span>}
                </p>
                <p className="text-[10px] text-zinc-500">
                  Joined {new Date(u.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-zinc-500 uppercase tracking-wide">Recovery code</p>
                <p className="font-mono font-bold tracking-widest text-acc">{u.recovery_code}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => changeCode(u)} className="rounded-xl bg-zinc-800 py-2 text-xs">Change code</button>
              <button onClick={() => changePassword(u)} className="rounded-xl bg-zinc-800 py-2 text-xs">Set password</button>
              {u.id !== meId && (
                <>
                  <button onClick={() => toggleAdmin(u)} className="rounded-xl bg-zinc-800 py-2 text-xs">
                    {u.is_admin ? "Remove admin" : "Make admin"}
                  </button>
                  <button onClick={() => deleteUser(u)} className="rounded-xl border border-acc/30 text-acc py-2 text-xs">
                    Delete user
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {!filtered.length && <p className="text-xs text-zinc-600">No users match.</p>}
      </div>
    </div>
  );
}
