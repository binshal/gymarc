"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { getActiveGoal, getTodayFoodLogs, sumMacros, GOAL_LABEL } from "@/lib/nutrition";
import type { SplitDay, Goal } from "@/lib/types";

const RING_COLORS: Record<string, string> = {
  Cal: "var(--acc)", Protein: "#3b82f6", Carbs: "#f59e0b", Fat: "#a855f7",
};

function Ring({ label, value, target, color }: { label: string; value: number; target: number | null; color: string }) {
  const pct = target ? Math.min(1, value / target) : 0;
  const r = 18, c = 2 * Math.PI * r;
  return (
    <div className="text-center">
      <svg width="44" height="44">
        <circle cx="22" cy="22" r={r} stroke="#27272a" strokeWidth="5" fill="none" />
        {target && (
          <circle
            cx="22" cy="22" r={r} stroke={color} strokeWidth="5" fill="none"
            strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round"
            transform="rotate(-90 22 22)"
          />
        )}
      </svg>
      <p className="text-[10px] mt-1 text-zinc-400">{label}</p>
      <p className="text-[9px] text-zinc-600">{Math.round(value)}{target ? `/${target}` : ""}</p>
    </div>
  );
}

export default function HomePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [days, setDays] = useState<SplitDay[]>([]);
  const [streak, setStreak] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [showWeightForm, setShowWeightForm] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [weightDate, setWeightDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weightSaving, setWeightSaving] = useState(false);
  const [lastWeight, setLastWeight] = useState<number | null>(null);
  const [restedToday, setRestedToday] = useState(false);
  const [restSessionId, setRestSessionId] = useState<string | null>(null);
  const [restLoading, setRestLoading] = useState(false);
  const [restError, setRestError] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: split } = await supabase
      .from("splits").select("*").eq("user_id", userData.user.id).eq("is_active", true).limit(1).maybeSingle();

    if (split) {
      const { data: d } = await supabase.from("split_days").select("*").eq("split_id", split.id).order("sort_order");
      setDays(d ?? []);
    }

    const { data: w } = await supabase
      .from("weight_logs").select("weight").eq("user_id", userData.user.id)
      .order("logged_at", { ascending: false }).limit(1).maybeSingle();
    setLastWeight(w?.weight ?? null);

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { data: sessions } = await supabase
      .from("workout_sessions").select("id, started_at, is_rest_day")
      .eq("user_id", userData.user.id).order("started_at", { ascending: false }).limit(60);

    const daysSeen = new Set((sessions ?? []).map((s: any) => new Date(s.started_at).toDateString()));
    let count = 0;
    for (let i = 0; ; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (daysSeen.has(d.toDateString())) count++; else break;
    }
    setStreak(count);

    const restToday = (sessions ?? []).find((s: any) => s.is_rest_day && new Date(s.started_at) >= todayStart);
    setRestedToday(!!restToday);
    setRestSessionId(restToday?.id ?? null);

    const [g, logs] = await Promise.all([
      getActiveGoal(supabase, userData.user.id),
      getTodayFoodLogs(supabase, userData.user.id),
    ]);
    setGoal(g);
    setTotals(sumMacros(logs));
  }

  function goToDay(dayId: string) {
    router.push(`/workout/session/${dayId}`);
  }

  async function logRestDay() {
    setRestError("");
    setRestLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setRestLoading(false); return; }

    const { error } = await supabase.from("workout_sessions").insert({
      user_id: userData.user.id,
      day_name: "Rest",
      is_rest_day: true,
      finished_at: new Date().toISOString(),
    });

    setRestLoading(false);
    if (error) { setRestError(error.message); return; }
    setRestedToday(true);
    await load();
  }

  async function logWeight() {
    const value = Number(weightInput);
    if (!value || weightSaving) return;
    setWeightSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setWeightSaving(false); return; }

    // Upsert: logging again for a date you already logged just updates it
    // (unique on user_id + logged_at), so backfilling a skipped day works
    // the same way as logging today.
    await supabase.from("weight_logs").upsert(
      { user_id: userData.user.id, weight: value, logged_at: weightDate },
      { onConflict: "user_id,logged_at" }
    );

    setWeightSaving(false);
    setShowWeightForm(false);
    setWeightInput("");
    await load();
  }

  async function undoRestDay() {
    if (!restSessionId) return;
    setRestLoading(true);
    await supabase.from("workout_sessions").delete().eq("id", restSessionId);
    setRestLoading(false);
    setRestedToday(false);
    setRestSessionId(null);
    await load();
  }

  return (
    <div className="space-y-4 max-w-md mx-auto md:max-w-none">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-xs text-zinc-500">Today</p>
          <p className="font-bold text-lg">Welcome back</p>
        </div>
        <Link href="/profile" className="w-9 h-9 rounded-full bg-zinc-800 block" />
      </div>

      <Link href="/food" className="block bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="flex justify-between items-center mb-3">
          <p className="font-semibold text-sm">Today's Macros</p>
          {goal && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-acc2/15 text-acc2">
              {GOAL_LABEL[goal.goal_type]}
            </span>
          )}
        </div>
        {goal ? (
          <div className="grid grid-cols-4 gap-2">
            <Ring label="Cal" value={totals.calories} target={goal.target_calories} color={RING_COLORS.Cal} />
            <Ring label="Protein" value={totals.protein} target={goal.target_protein} color={RING_COLORS.Protein} />
            <Ring label="Carbs" value={totals.carbs} target={goal.target_carbs} color={RING_COLORS.Carbs} />
            <Ring label="Fat" value={totals.fat} target={goal.target_fat} color={RING_COLORS.Fat} />
          </div>
        ) : (
          <p className="text-xs text-zinc-500">Set a goal on the Food tab to see progress here.</p>
        )}
      </Link>

      <button
        onClick={() => setShowDayPicker(true)}
        disabled={!days.length}
        className="w-full rounded-2xl py-4 font-bold text-sm text-white bg-acc disabled:opacity-40"
      >
        {days.length ? "Start Workout" : "Add a split to start"}
      </button>

      {!restedToday ? (
        <button
          onClick={logRestDay}
          disabled={restLoading}
          className="w-full rounded-2xl py-2.5 text-xs border border-zinc-800 text-zinc-400 disabled:opacity-50"
        >
          {restLoading ? "Logging…" : "Rest today instead"}
        </button>
      ) : (
        <div className="w-full rounded-2xl py-2.5 text-xs border border-acc2/40 bg-acc2/10 text-acc2 flex items-center justify-center gap-3">
          <span>✓ Resting today</span>
          <button onClick={undoRestDay} disabled={restLoading} className="underline underline-offset-2">
            Undo
          </button>
        </div>
      )}
      {restError && <p className="text-[10px] text-acc text-center">{restError}</p>}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { setWeightDate(new Date().toISOString().slice(0, 10)); setWeightInput(lastWeight ? String(lastWeight) : ""); setShowWeightForm(true); }}
          className="bg-zinc-900 border border-zinc-800 hover:border-acc/50 rounded-xl p-3 text-left transition"
        >
          <div className="flex justify-between items-start">
            <p className="text-xs text-zinc-500 mb-1">Weight</p>
            <span className="text-[9px] text-acc font-semibold">+ Log</span>
          </div>
          <p className="font-bold text-lg">{lastWeight ?? "—"} <span className="text-xs text-zinc-500 font-normal">kg</span></p>
        </button>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
          <p className="text-xs text-zinc-500 mb-1">Streak</p>
          <p className="font-bold text-lg">{streak} <span className="text-xs text-zinc-500 font-normal">days</span></p>
        </div>
      </div>

      {showWeightForm && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50"
          onClick={() => setShowWeightForm(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-sm p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-semibold text-sm">Log weight</p>
            <p className="text-[10px] text-zinc-500">
              Pick a date to backfill a skipped day, or leave it on today.
            </p>
            <input
              type="date"
              className="w-full bg-zinc-800 rounded-xl px-3 py-2.5 text-sm"
              value={weightDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setWeightDate(e.target.value)}
            />
            <input
              type="number"
              step="0.1"
              className="w-full bg-zinc-800 rounded-xl px-3 py-2.5 text-sm"
              placeholder="Weight (kg)"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              autoFocus
            />
            <button
              onClick={logWeight}
              disabled={weightSaving || !weightInput}
              className="w-full rounded-2xl py-3 font-bold text-sm text-white bg-acc disabled:opacity-50"
            >
              {weightSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {showDayPicker && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50"
          onClick={() => setShowDayPicker(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-sm p-4 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-semibold text-sm mb-2">Which day are you training?</p>
            {days.map((day) => (
              <button
                key={day.id}
                onClick={() => goToDay(day.id)}
                className="block w-full text-left px-4 py-3 rounded-xl bg-zinc-800 text-sm hover:bg-zinc-700"
              >
                {day.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
