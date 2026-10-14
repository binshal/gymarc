"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { WeightLog, FoodLog } from "@/lib/types";
import { sumMacros } from "@/lib/nutrition";

type SessionRow = {
  id: string; day_name: string; is_rest_day: boolean; started_at: string; finished_at: string | null;
};
type SetRow = {
  id: string; session_id: string; exercise_id: string; weight: number; reps: number; set_type: string; is_pr: boolean;
  exercise?: { name: string };
};

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [userId, setUserId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [setsBySession, setSetsBySession] = useState<Record<string, SetRow[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dayLogs, setDayLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [username]);
  useEffect(() => { if (userId) loadDayLogs(); }, [userId, selectedDate]);

  async function load() {
    const { data: profile } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
    if (!profile) { setNotFound(true); setLoading(false); return; }
    setUserId(profile.id);

    const { data: s } = await supabase
      .from("workout_sessions")
      .select("id, day_name, is_rest_day, started_at, finished_at")
      .eq("user_id", profile.id)
      .not("finished_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(30);
    setSessions(s ?? []);

    const ids = (s ?? []).map((r) => r.id);
    if (ids.length) {
      const { data: sets } = await supabase
        .from("workout_sets").select("*, exercise:exercises(name)").in("session_id", ids).order("set_number");
      const grouped: Record<string, SetRow[]> = {};
      for (const row of (sets as any as SetRow[]) ?? []) (grouped[row.session_id] ??= []).push(row);
      setSetsBySession(grouped);
    }

    const { data: w } = await supabase
      .from("weight_logs").select("*").eq("user_id", profile.id)
      .order("logged_at", { ascending: true }).limit(200);
    setWeights(w ?? []);

    setLoading(false);
  }

  async function loadDayLogs() {
    if (!userId) return;
    const { data } = await supabase
      .from("food_logs").select("*").eq("user_id", userId).eq("logged_at", selectedDate);
    setDayLogs(data ?? []);
  }

  function volumeFor(sets: SetRow[]) {
    return sets.filter((s) => s.set_type !== "warmup").reduce((sum, s) => sum + s.weight * s.reps, 0);
  }

  const weightChartData = useMemo(
    () => weights.slice(-90).map((w) => ({ date: w.logged_at, weight: Number(w.weight) })),
    [weights]
  );

  const dayTotals = sumMacros(dayLogs);

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (notFound) return <p className="text-sm text-zinc-500">No user called "{username}".</p>;

  return (
    <div className="max-w-md mx-auto md:max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="text-zinc-500 text-sm">←</button>
        <div className="w-9 h-9 rounded-full bg-zinc-800" />
        <h1 className="font-bold text-lg">{username}</h1>
      </div>

      {weightChartData.length > 1 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="font-semibold text-sm mb-3">Weight progress</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#71717a" }}
                  tickFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                <YAxis tick={{ fontSize: 9, fill: "#71717a" }} width={30} domain={["dataMin - 1", "dataMax + 1"]} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", fontSize: 11 }} />
                <Line type="monotone" dataKey="weight" stroke="#e11d48" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="flex justify-between items-center mb-3">
          <p className="font-semibold text-sm">Macros</p>
          <input
            type="date"
            className="bg-zinc-800 rounded-lg px-2 py-1 text-[11px]"
            value={selectedDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div><p className="font-bold">{Math.round(dayTotals.calories)}</p><p className="text-[9px] text-zinc-500">kcal</p></div>
          <div><p className="font-bold">{Math.round(dayTotals.protein)}</p><p className="text-[9px] text-zinc-500">protein</p></div>
          <div><p className="font-bold">{Math.round(dayTotals.carbs)}</p><p className="text-[9px] text-zinc-500">carbs</p></div>
          <div><p className="font-bold">{Math.round(dayTotals.fat)}</p><p className="text-[9px] text-zinc-500">fat</p></div>
        </div>
        {!dayLogs.length && <p className="text-[10px] text-zinc-600 pt-2">Nothing logged that day.</p>}
      </div>

      <div>
        <p className="font-semibold text-sm mb-2">Workouts</p>
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
                <button onClick={() => setExpanded(isOpen ? null : sess.id)} className="w-full flex justify-between items-center p-4 text-left">
                  <div>
                    <p className="text-sm font-semibold">{sess.day_name}</p>
                    <p className="text-[10px] text-zinc-500">
                      {new Date(sess.started_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                      {` · ${sets.length} sets · ${volumeFor(sets).toLocaleString()}kg`}
                    </p>
                  </div>
                  <span className="text-zinc-600 text-xs">{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 space-y-2 border-t border-zinc-800 pt-3">
                    {Object.entries(grouped).map(([exId, exSets]) => (
                      <div key={exId}>
                        <p className="text-xs font-semibold mb-1">{exSets[0].exercise?.name}</p>
                        {exSets.map((s) => (
                          <div key={s.id} className="flex justify-between text-xs bg-zinc-800/50 rounded-lg px-3 py-1.5 mb-1">
                            <span>{s.weight}kg × {s.reps}</span>
                            {s.is_pr && <span className="text-acc">🏆</span>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {!sessions.length && <p className="text-xs text-zinc-600">No workouts yet.</p>}
        </div>
      </div>
    </div>
  );
}
