"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { WeightLog } from "@/lib/types";

type SessionRow = {
  id: string;
  split_day_id: string | null;
  day_name: string;
  is_rest_day: boolean;
  started_at: string;
  finished_at: string | null;
};

type SetRow = {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  set_type: string;
  is_pr: boolean;
  exercise?: { name: string };
};

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time", days: null as number | null },
];

export default function ProfilePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [setsBySession, setSetsBySession] = useState<Record<string, SetRow[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);
  const [exerciseFilter, setExerciseFilter] = useState("all");
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [showWeights, setShowWeights] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: profile } = await supabase.from("profiles").select("username, is_admin").eq("id", userData.user.id).single();
    setUsername(profile?.username ?? "");
    setIsAdmin(!!profile?.is_admin);

    const { data: s } = await supabase
      .from("workout_sessions")
      .select("id, split_day_id, day_name, is_rest_day, started_at, finished_at")
      .eq("user_id", userData.user.id)
      .order("started_at", { ascending: false })
      .limit(200);
    setSessions(s ?? []);

    const ids = (s ?? []).map((row) => row.id);
    if (ids.length) {
      const { data: sets } = await supabase
        .from("workout_sets")
        .select("*, exercise:exercises(name)")
        .in("session_id", ids)
        .order("set_number");
      const grouped: Record<string, SetRow[]> = {};
      for (const row of (sets as any as SetRow[]) ?? []) {
        (grouped[row.session_id] ??= []).push(row);
      }
      setSetsBySession(grouped);
    }
    const { data: w } = await supabase
      .from("weight_logs").select("*").eq("user_id", userData.user.id)
      .order("logged_at", { ascending: false }).limit(60);
    setWeights(w ?? []);

    setLoading(false);
  }

  async function updateWeight(id: string, value: number) {
    if (!value) return;
    await supabase.from("weight_logs").update({ weight: value }).eq("id", id);
    setWeights((w) => w.map((row) => (row.id === id ? { ...row, weight: value } : row)));
  }

  async function deleteWeight(id: string) {
    await supabase.from("weight_logs").delete().eq("id", id);
    setWeights((w) => w.filter((row) => row.id !== id));
  }

  async function deleteSet(id: string, sessionId: string) {
    await supabase.from("workout_sets").delete().eq("id", id);
    setSetsBySession((prev) => ({ ...prev, [sessionId]: prev[sessionId].filter((s) => s.id !== id) }));
  }

  async function deleteSession(id: string) {
    if (!confirm("Delete this entire workout, including all its sets? This can't be undone.")) return;
    await supabase.from("workout_sessions").delete().eq("id", id);
    setSessions((s) => s.filter((row) => row.id !== id));
    if (expanded === id) setExpanded(null);
  }

  function volumeFor(sets: SetRow[]) {
    return sets.filter((s) => s.set_type !== "warmup").reduce((sum, s) => sum + s.weight * s.reps, 0);
  }

  const exerciseOptions = useMemo(() => {
    const names = new Map<string, string>();
    Object.values(setsBySession).flat().forEach((s) => {
      if (s.exercise?.name) names.set(s.exercise_id, s.exercise.name);
    });
    return Array.from(names.entries());
  }, [setsBySession]);

  const summary = useMemo(() => {
    const cutoff = range ? Date.now() - range * 86400000 : 0;
    let totalSets = 0, totalVolume = 0, workouts = 0;
    for (const sess of sessions) {
      if (sess.is_rest_day) continue;
      if (new Date(sess.started_at).getTime() < cutoff) continue;
      const sets = (setsBySession[sess.id] ?? []).filter(
        (s) => exerciseFilter === "all" || s.exercise_id === exerciseFilter
      );
      if (!sets.length) continue;
      workouts += 1;
      totalSets += sets.length;
      totalVolume += volumeFor(sets);
    }
    return { totalSets, totalVolume, workouts };
  }, [sessions, setsBySession, range, exerciseFilter]);

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="max-w-md mx-auto md:max-w-2xl space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-xs text-zinc-500">Profile</p>
          <h1 className="font-bold text-lg">{username || "You"}</h1>
        </div>
        <button
          onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
          className="text-xs text-acc border border-acc/30 rounded-lg px-3 py-1.5 hover:bg-acc/10"
        >
          Log out
        </button>
      </div>

      {isAdmin && (
        <Link href="/admin" className="block rounded-2xl border border-acc/30 bg-acc/5 p-4 text-sm font-semibold text-acc">
          🛠 Admin panel →
        </Link>
      )}

      {/* Summary */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <p className="font-semibold text-sm">Summary</p>

        <div className="flex gap-2 overflow-x-auto">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.days as any)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] ${
                range === r.days ? "bg-acc text-white" : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <select
          value={exerciseFilter}
          onChange={(e) => setExerciseFilter(e.target.value)}
          className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-xs"
        >
          <option value="all">All exercises</option>
          {exerciseOptions.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="text-center">
            <p className="font-bold text-lg">{summary.workouts}</p>
            <p className="text-[10px] text-zinc-500">Workouts</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg">{summary.totalSets}</p>
            <p className="text-[10px] text-zinc-500">Sets</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg">{summary.totalVolume.toLocaleString()}</p>
            <p className="text-[10px] text-zinc-500">Volume (kg)</p>
          </div>
        </div>
        {range === null && sessions.length === 200 && (
          <p className="text-[10px] text-zinc-600">Showing your most recent 200 sessions.</p>
        )}
      </div>

      {/* Weight history */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowWeights((v) => !v)}
          className="w-full flex justify-between items-center p-4 text-left"
        >
          <p className="font-semibold text-sm">
            Weight {weights[0] ? `· ${weights[0].weight}kg latest` : ""}
          </p>
          <span className="text-zinc-600 text-xs">{showWeights ? "▲" : "▼"}</span>
        </button>
        {showWeights && (
          <div className="px-4 pb-4 space-y-1.5 border-t border-zinc-800 pt-3">
            {weights.map((w) => (
              <div key={w.id} className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-1.5 text-xs">
                <span className="text-zinc-400">
                  {new Date(w.logged_at + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <input
                  type="number"
                  step="0.1"
                  defaultValue={w.weight}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v && v !== w.weight) updateWeight(w.id, v);
                  }}
                  className="w-16 bg-zinc-800 rounded px-1 py-0.5 text-center"
                />
                <button onClick={() => deleteWeight(w.id)} className="text-zinc-600 hover:text-acc">✕</button>
              </div>
            ))}
            {!weights.length && <p className="text-xs text-zinc-600">No weight logged yet.</p>}
          </div>
        )}
      </div>

      {/* History */}
      <div>
        <p className="font-semibold text-sm mb-2">History</p>
        <div className="space-y-2">
          {sessions.map((sess) => {
            const sets = setsBySession[sess.id] ?? [];
            const isOpen = expanded === sess.id;
            const grouped = sets.reduce<Record<string, SetRow[]>>((acc, s) => {
              (acc[s.exercise_id] ??= []).push(s);
              return acc;
            }, {});
            return (
              <div key={sess.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : sess.id)}
                  className="w-full flex justify-between items-center p-4 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {sess.is_rest_day ? "😴 Rest Day" : sess.day_name}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {new Date(sess.started_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                      {!sess.is_rest_day && ` · ${sets.length} sets · ${volumeFor(sets).toLocaleString()}kg`}
                      {!sess.finished_at && !sess.is_rest_day && " · in progress"}
                    </p>
                  </div>
                  <span className="text-zinc-600 text-xs">{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && !sess.is_rest_day && (
                  <div className="px-4 pb-4 space-y-3 border-t border-zinc-800 pt-3">
                    {Object.entries(grouped).map(([exId, exSets]) => (
                      <div key={exId}>
                        <p className="text-xs font-semibold mb-1">{exSets[0].exercise?.name}</p>
                        <div className="space-y-1">
                          {exSets.map((s) => (
                            <div key={s.id} className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-1.5 text-xs">
                              <span>
                                {s.weight}kg × {s.reps} <span className="text-zinc-600">· {s.set_type}</span>
                                {s.is_pr && <span className="text-acc ml-1">🏆</span>}
                              </span>
                              <button onClick={() => deleteSet(s.id, sess.id)} className="text-zinc-600 hover:text-acc">
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {!sets.length && <p className="text-xs text-zinc-600">No sets logged.</p>}
                    <div className="flex items-center justify-between pt-1">
                      {sess.split_day_id && sets.length > 0 ? (
                        <button
                          onClick={() => router.push(`/workout/session/${sess.split_day_id}?copy=${sess.id}`)}
                          className="text-[11px] font-semibold text-white bg-acc rounded-lg px-3 py-1.5"
                        >
                          Repeat this workout
                        </button>
                      ) : <span />}
                      <button onClick={() => deleteSession(sess.id)} className="text-[11px] text-acc">
                        Delete this workout
                      </button>
                    </div>
                  </div>
                )}

                {isOpen && sess.is_rest_day && (
                  <div className="px-4 pb-4 border-t border-zinc-800 pt-3">
                    <button onClick={() => deleteSession(sess.id)} className="text-[11px] text-acc">
                      Delete this rest day
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {!sessions.length && (
            <p className="text-sm text-zinc-500">No workouts logged yet — finish one to see it here.</p>
          )}
        </div>
      </div>
    </div>
  );
}
