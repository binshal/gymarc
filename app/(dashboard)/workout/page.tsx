"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Split, SplitDay } from "@/lib/types";

export default function WorkoutPage() {
  const supabase = supabaseBrowser();
  const [splits, setSplits] = useState<Split[]>([]);
  const [activeSplitId, setActiveSplitId] = useState<string | null>(null);
  const [days, setDays] = useState<SplitDay[]>([]);
  const [showNewSplit, setShowNewSplit] = useState(false);
  const [showNewDay, setShowNewDay] = useState(false);
  const [newSplitName, setNewSplitName] = useState("");
  const [newDayName, setNewDayName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSplits(); }, []);
  useEffect(() => { if (activeSplitId) loadDays(activeSplitId); }, [activeSplitId]);

  async function loadSplits() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase.from("splits").select("*").eq("user_id", userData.user.id).order("id");
    setSplits(data ?? []);
    if (data && data.length && !activeSplitId) setActiveSplitId(data[0].id);
    setLoading(false);
  }

  async function loadDays(splitId: string) {
    const { data } = await supabase.from("split_days").select("*").eq("split_id", splitId).order("sort_order");
    setDays(data ?? []);
  }

  async function createSplit() {
    if (!newSplitName.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase
      .from("splits").insert({ name: newSplitName.trim(), user_id: userData.user.id }).select().single();
    setNewSplitName(""); setShowNewSplit(false);
    if (data) { setSplits((s) => [...s, data]); setActiveSplitId(data.id); }
  }

  async function deleteSplit(id: string) {
    if (!confirm("Delete this split and all its days?")) return;
    await supabase.from("splits").delete().eq("id", id);
    setSplits((s) => s.filter((sp) => sp.id !== id));
    if (activeSplitId === id) setActiveSplitId(null);
  }

  async function addDay() {
    if (!newDayName.trim() || !activeSplitId) return;
    const { data } = await supabase
      .from("split_days")
      .insert({ split_id: activeSplitId, name: newDayName.trim(), sort_order: days.length })
      .select().single();
    setNewDayName(""); setShowNewDay(false);
    if (data) setDays((d) => [...d, data]);
  }

  async function deleteDay(id: string) {
    if (!confirm("Delete this day and its exercises?")) return;
    await supabase.from("split_days").delete().eq("id", id);
    setDays((d) => d.filter((day) => day.id !== id));
  }

  async function renameDay(id: string, name: string) {
    if (!name.trim()) return;
    await supabase.from("split_days").update({ name }).eq("id", id);
    setDays((d) => d.map((day) => (day.id === id ? { ...day, name } : day)));
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="max-w-md mx-auto md:max-w-2xl space-y-6">
      <h1 className="font-bold text-lg">Your Splits</h1>

      {/* Split cards */}
      <div className="grid grid-cols-2 gap-3">
        {splits.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSplitId(s.id)}
            className={`text-left rounded-2xl p-4 border transition ${
              activeSplitId === s.id
                ? "bg-acc/10 border-acc"
                : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <p className="font-semibold text-sm">{s.name}</p>
            <p className="text-[10px] text-zinc-500 mt-1">Tap to manage</p>
          </button>
        ))}

        {!showNewSplit ? (
          <button
            onClick={() => setShowNewSplit(true)}
            className="rounded-2xl p-4 border border-dashed border-zinc-700 text-zinc-500 text-sm flex items-center justify-center hover:border-zinc-500 hover:text-zinc-300"
          >
            + New split
          </button>
        ) : (
          <div className="rounded-2xl p-3 border border-zinc-800 bg-zinc-900 space-y-2">
            <input
              autoFocus
              className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-xs"
              placeholder="e.g. Push Pull Legs"
              value={newSplitName}
              onChange={(e) => setNewSplitName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createSplit()}
            />
            <div className="flex gap-2">
              <button onClick={createSplit} className="flex-1 bg-acc rounded-lg py-1.5 text-xs font-semibold text-white">Add</button>
              <button onClick={() => setShowNewSplit(false)} className="px-3 text-xs text-zinc-500">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {activeSplitId && (
        <>
          <div className="flex justify-between items-center pt-2">
            <h2 className="font-semibold text-sm">Days</h2>
            <button onClick={() => deleteSplit(activeSplitId)} className="text-[11px] text-acc">
              Delete this split
            </button>
          </div>

          <div className="space-y-3">
            {days.map((day) => (
              <div key={day.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <input
                    className="flex-1 bg-transparent text-sm font-semibold outline-none border-b border-transparent focus:border-zinc-700 pb-1"
                    defaultValue={day.name}
                    onBlur={(e) => renameDay(day.id, e.target.value)}
                  />
                  <button onClick={() => deleteDay(day.id)} className="text-[11px] text-acc shrink-0">
                    Delete
                  </button>
                </div>
                <Link
                  href={`/workout/day/${day.id}`}
                  className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-zinc-800 py-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  🏋️ Edit exercises
                </Link>
              </div>
            ))}

            {!showNewDay ? (
              <button
                onClick={() => setShowNewDay(true)}
                className="w-full rounded-2xl p-4 border border-dashed border-zinc-700 text-zinc-500 text-sm hover:border-zinc-500 hover:text-zinc-300"
              >
                + Add a day
              </button>
            ) : (
              <div className="rounded-2xl p-3 border border-zinc-800 bg-zinc-900 space-y-2">
                <input
                  autoFocus
                  className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. Push Day"
                  value={newDayName}
                  onChange={(e) => setNewDayName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDay()}
                />
                <div className="flex gap-2">
                  <button onClick={addDay} className="flex-1 bg-acc rounded-lg py-2 text-sm font-semibold text-white">Add day</button>
                  <button onClick={() => setShowNewDay(false)} className="px-3 text-sm text-zinc-500">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {!splits.length && (
        <p className="text-sm text-zinc-500">Create your first split to start building out your days.</p>
      )}
    </div>
  );
}
