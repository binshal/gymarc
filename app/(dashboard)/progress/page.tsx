"use client";
import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Legend,
} from "recharts";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { WeightLog } from "@/lib/types";

type SetRow = {
  weight: number;
  reps: number;
  set_type: string;
  exercise_id: string;
  exercise: { name: string; muscle_group: string | null } | null;
  workout_sessions: { started_at: string; is_rest_day: boolean } | null;
};

const MUSCLE_COLORS: Record<string, string> = {
  Chest: "#e11d48", Back: "#3b82f6", Legs: "#059669", Shoulders: "#f59e0b",
  Biceps: "#a855f7", Triceps: "#ec4899", Core: "#22d3ee", Other: "#71717a",
};

function epley1RM(weight: number, reps: number) {
  return Math.round(weight * (1 + reps / 30));
}

function weekKey(d: Date) {
  const start = new Date(d);
  start.setDate(start.getDate() - start.getDay()); // Sunday-start week
  return start.toISOString().slice(0, 10);
}

export default function ProgressPage() {
  const supabase = supabaseBrowser();
  const [sets, setSets] = useState<SetRow[]>([]);
  const [sessions, setSessions] = useState<{ started_at: string; is_rest_day: boolean }[]>([]);
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [weightRange, setWeightRange] = useState(90);
  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: setRows } = await supabase
      .from("workout_sets")
      .select("weight, reps, set_type, exercise_id, exercise:exercises(name, muscle_group), workout_sessions!inner(started_at, is_rest_day, user_id)")
      .eq("workout_sessions.user_id", userData.user.id)
      .order("workout_sessions(started_at)", { ascending: true })
      .limit(1000);
    const rows = (setRows as any as SetRow[]) ?? [];
    setSets(rows);
    if (rows.length && !selectedExercise) setSelectedExercise(rows[rows.length - 1].exercise_id);

    const since = new Date(); since.setDate(since.getDate() - 45);
    const { data: sessRows } = await supabase
      .from("workout_sessions")
      .select("started_at, is_rest_day")
      .eq("user_id", userData.user.id)
      .gte("started_at", since.toISOString());
    setSessions(sessRows ?? []);

    const { data: weightRows } = await supabase
      .from("weight_logs")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("logged_at", { ascending: true })
      .limit(400);
    setWeights(weightRows ?? []);

    setLoading(false);
  }

  const exerciseOptions = useMemo(() => {
    const names = new Map<string, string>();
    sets.forEach((s) => { if (s.exercise?.name) names.set(s.exercise_id, s.exercise.name); });
    return Array.from(names.entries());
  }, [sets]);

  const exerciseChartData = useMemo(() => {
    if (!selectedExercise) return [];
    const bySession: Record<string, { date: string; maxWeight: number; est1rm: number }> = {};
    sets
      .filter((s) => s.exercise_id === selectedExercise && s.set_type !== "warmup" && s.workout_sessions)
      .forEach((s) => {
        const date = s.workout_sessions!.started_at.slice(0, 10);
        const est = epley1RM(s.weight, s.reps);
        if (!bySession[date]) bySession[date] = { date, maxWeight: s.weight, est1rm: est };
        else {
          bySession[date].maxWeight = Math.max(bySession[date].maxWeight, s.weight);
          bySession[date].est1rm = Math.max(bySession[date].est1rm, est);
        }
      });
    return Object.values(bySession).sort((a, b) => a.date.localeCompare(b.date));
  }, [sets, selectedExercise]);

  const weightChartData = useMemo(() => {
    const cutoff = Date.now() - weightRange * 86400000;
    const filtered = weights.filter((w) => new Date(w.logged_at).getTime() >= cutoff);
    return filtered.map((w, i) => {
      const windowStart = Math.max(0, i - 6);
      const windowSlice = filtered.slice(windowStart, i + 1);
      const avg = windowSlice.reduce((s, x) => s + Number(x.weight), 0) / windowSlice.length;
      return { date: w.logged_at, weight: Number(w.weight), avg7: Math.round(avg * 10) / 10 };
    });
  }, [weights, weightRange]);

  const weightChange = weightChartData.length > 1
    ? Math.round((weightChartData[weightChartData.length - 1].weight - weightChartData[0].weight) * 10) / 10
    : null;

  const currentBest1RM = exerciseChartData.length ? Math.max(...exerciseChartData.map((d) => d.est1rm)) : 0;

  const muscleGroups = useMemo(() => {
    const groups = new Set<string>();
    sets.forEach((s) => groups.add(s.exercise?.muscle_group || "Other"));
    return Array.from(groups);
  }, [sets]);

  const weeklyVolumeData = useMemo(() => {
    const byWeek: Record<string, Record<string, number>> = {};
    sets
      .filter((s) => s.set_type !== "warmup" && s.workout_sessions)
      .forEach((s) => {
        const wk = weekKey(new Date(s.workout_sessions!.started_at));
        const mg = s.exercise?.muscle_group || "Other";
        byWeek[wk] ??= {};
        byWeek[wk][mg] = (byWeek[wk][mg] ?? 0) + s.weight * s.reps;
      });
    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([week, groups]) => ({
        week: new Date(week + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        ...groups,
      }));
  }, [sets]);

  // Calendar: last 42 days, 6 rows x 7 cols, ending today
  const calendarDays = useMemo(() => {
    const daysSeen = new Map<string, boolean>(); // date -> is_rest_day
    sessions.forEach((s) => {
      const key = new Date(s.started_at).toDateString();
      const prev = daysSeen.get(key);
      if (prev === undefined || (!prev && s.is_rest_day === false)) daysSeen.set(key, s.is_rest_day);
    });
    const days: { date: Date; status: "workout" | "rest" | "none" }[] = [];
    for (let i = 41; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const seen = daysSeen.get(d.toDateString());
      days.push({ date: d, status: seen === undefined ? "none" : seen ? "rest" : "workout" });
    }
    return days;
  }, [sessions]);

  const currentStreak = useMemo(() => {
    let count = 0;
    for (let i = calendarDays.length - 1; i >= 0; i--) {
      if (calendarDays[i].status !== "none") count++; else break;
    }
    return count;
  }, [calendarDays]);

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="max-w-md mx-auto md:max-w-2xl space-y-6">
      <h1 className="font-bold text-lg">Progress</h1>

      {/* Body weight */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="flex justify-between items-center mb-3">
          <p className="font-semibold text-sm">Body weight</p>
          {weightChange !== null && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${weightChange <= 0 ? "bg-acc2/15 text-acc2" : "bg-acc/15 text-acc"}`}>
              {weightChange > 0 ? "+" : ""}{weightChange}kg over period
            </span>
          )}
        </div>

        <div className="flex gap-2 mb-3">
          {[30, 90, 365].map((d) => (
            <button
              key={d}
              onClick={() => setWeightRange(d)}
              className={`px-3 py-1 rounded-lg text-[11px] ${
                weightRange === d ? "bg-acc text-white" : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {d === 365 ? "1y" : `${d}d`}
            </button>
          ))}
        </div>

        {weightChartData.length > 1 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#71717a" }}
                  tickFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                <YAxis tick={{ fontSize: 9, fill: "#71717a" }} width={30} domain={["dataMin - 1", "dataMax + 1"]} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", fontSize: 11 }} />
                <Line type="monotone" dataKey="weight" name="Weight (kg)" stroke="#71717a" strokeWidth={1.5} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="avg7" name="7-day avg" stroke="#e11d48" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-zinc-600 py-6 text-center">
            Log weight on two or more days to see a trend line. Tap the Weight card on Home to log.
          </p>
        )}
      </div>

      {/* Exercise progress */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="flex justify-between items-center mb-3">
          <p className="font-semibold text-sm">Exercise progress</p>
          {currentBest1RM > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-acc/15 text-acc">
              Est. 1RM {currentBest1RM}kg
            </span>
          )}
        </div>

        {exerciseOptions.length ? (
          <>
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-xs mb-3"
            >
              {exerciseOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>

            {exerciseChartData.length > 1 ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={exerciseChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#71717a" }}
                      tickFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                    <YAxis tick={{ fontSize: 9, fill: "#71717a" }} width={30} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", fontSize: 11 }} />
                    <Line type="monotone" dataKey="maxWeight" name="Top set (kg)" stroke="#e11d48" strokeWidth={2} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="est1rm" name="Est. 1RM" stroke="#059669" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-zinc-600 py-6 text-center">
                Log this exercise on two or more days to see a trend line.
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-zinc-600">Finish a workout to see progress here.</p>
        )}
      </div>

      {/* Weekly volume by muscle group */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <p className="font-semibold text-sm mb-3">Weekly volume by muscle group</p>
        {weeklyVolumeData.length ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyVolumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="week" tick={{ fontSize: 9, fill: "#71717a" }} />
                <YAxis tick={{ fontSize: 9, fill: "#71717a" }} width={35} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {muscleGroups.map((mg) => (
                  <Bar key={mg} dataKey={mg} stackId="vol" fill={MUSCLE_COLORS[mg] ?? MUSCLE_COLORS.Other} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-zinc-600">No volume logged yet.</p>
        )}
      </div>

      {/* Streak calendar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="flex justify-between items-center mb-3">
          <p className="font-semibold text-sm">Streak</p>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-acc/15 text-acc">{currentStreak} days</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {calendarDays.map((d, i) => (
            <div
              key={i}
              title={d.date.toDateString()}
              className={`aspect-square rounded-md flex items-center justify-center text-[8px] ${
                d.status === "workout" ? "bg-acc text-white"
                : d.status === "rest" ? "bg-acc2/40 text-white"
                : "bg-zinc-800 text-zinc-600"
              }`}
            >
              {d.date.getDate()}
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-[9px] text-zinc-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-acc inline-block" /> Workout</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-acc2/40 inline-block" /> Rest</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-zinc-800 inline-block" /> Nothing logged</span>
        </div>
      </div>
    </div>
  );
}
