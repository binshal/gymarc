"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { getActiveGoal, daysLeft, GOAL_LABEL } from "@/lib/nutrition";
import type { Goal, GoalType } from "@/lib/types";

export default function GoalPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [current, setCurrent] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [goalType, setGoalType] = useState<GoalType>("maintenance");
  const [durationDays, setDurationDays] = useState(30);
  const [targetWeight, setTargetWeight] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const goal = await getActiveGoal(supabase, userData.user.id);
    setCurrent(goal);
    setLoading(false);
  }

  async function endGoal() {
    if (!current) return;
    if (!confirm("End this goal? You can start a new one right after.")) return;
    await supabase.from("goals").update({ status: "completed" }).eq("id", current.id);
    setCurrent(null);
  }

  async function createGoal() {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setSaving(false); return; }

    if (current) {
      await supabase.from("goals").update({ status: "completed" }).eq("id", current.id);
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    await supabase.from("goals").insert({
      user_id: userData.user.id,
      goal_type: goalType,
      end_date: endDate.toISOString().slice(0, 10),
      target_weight: targetWeight ? Number(targetWeight) : null,
      target_calories: calories ? Number(calories) : null,
      target_protein: protein ? Number(protein) : null,
      target_carbs: carbs ? Number(carbs) : null,
      target_fat: fat ? Number(fat) : null,
      status: "active",
    });

    setSaving(false);
    router.push("/food");
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="max-w-md mx-auto md:max-w-lg space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="text-zinc-500 text-sm">←</button>
        <h1 className="font-bold text-lg">Goal</h1>
      </div>

      {current && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between items-center">
            <p className="font-semibold text-sm">Current: {GOAL_LABEL[current.goal_type]}</p>
            <span className="text-[10px] text-zinc-500">{daysLeft(current)} days left</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1">
            <div><p className="font-bold">{current.target_calories ?? "—"}</p><p className="text-[9px] text-zinc-500">kcal</p></div>
            <div><p className="font-bold">{current.target_protein ?? "—"}</p><p className="text-[9px] text-zinc-500">protein</p></div>
            <div><p className="font-bold">{current.target_carbs ?? "—"}</p><p className="text-[9px] text-zinc-500">carbs</p></div>
            <div><p className="font-bold">{current.target_fat ?? "—"}</p><p className="text-[9px] text-zinc-500">fat</p></div>
          </div>
          <button onClick={endGoal} className="text-[11px] text-acc pt-1">End this goal</button>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
        <p className="font-semibold text-sm">{current ? "Start a new goal" : "Set a goal"}</p>

        <div>
          <p className="text-[10px] text-zinc-500 mb-2 uppercase tracking-wide">Type</p>
          <div className="grid grid-cols-3 gap-2">
            {(["bulk", "cut", "maintenance"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setGoalType(t)}
                className={`rounded-xl py-2 text-xs font-semibold capitalize ${
                  goalType === t ? "bg-acc text-white" : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] text-zinc-500 mb-2 uppercase tracking-wide">Duration</p>
          <div className="flex gap-2">
            {[14, 30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDurationDays(d)}
                className={`flex-1 rounded-xl py-2 text-xs font-semibold ${
                  durationDays === d ? "bg-acc text-white" : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] text-zinc-500 mb-2 uppercase tracking-wide">Daily targets</p>
          <div className="grid grid-cols-2 gap-2">
            <input className="bg-zinc-800 rounded-xl px-3 py-2.5 text-sm" placeholder="Calories" type="number" value={calories} onChange={(e) => setCalories(e.target.value)} />
            <input className="bg-zinc-800 rounded-xl px-3 py-2.5 text-sm" placeholder="Protein (g)" type="number" value={protein} onChange={(e) => setProtein(e.target.value)} />
            <input className="bg-zinc-800 rounded-xl px-3 py-2.5 text-sm" placeholder="Carbs (g)" type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
            <input className="bg-zinc-800 rounded-xl px-3 py-2.5 text-sm" placeholder="Fat (g)" type="number" value={fat} onChange={(e) => setFat(e.target.value)} />
          </div>
        </div>

        <div>
          <p className="text-[10px] text-zinc-500 mb-2 uppercase tracking-wide">Target weight (optional)</p>
          <input className="w-full bg-zinc-800 rounded-xl px-3 py-2.5 text-sm" placeholder="kg" type="number" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} />
        </div>

        <button
          onClick={createGoal}
          disabled={saving}
          className="w-full rounded-2xl py-3 font-bold text-sm text-white bg-acc disabled:opacity-50"
        >
          {saving ? "Saving…" : current ? "Start new goal" : "Set goal"}
        </button>
      </div>
    </div>
  );
}
