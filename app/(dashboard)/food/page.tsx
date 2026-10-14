"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { getActiveGoal, getTodayFoodLogs, sumMacros, daysLeft, GOAL_LABEL } from "@/lib/nutrition";
import type { Goal, Food, FoodLog, Supplement, SupplementLog } from "@/lib/types";

type CustomField = { key: string; value: string };

export default function FoodPage() {
  const supabase = supabaseBrowser();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [recents, setRecents] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);

  // Water
  const [waterMl, setWaterMl] = useState(0);
  const [waterTarget, setWaterTarget] = useState(3000);
  const [customWater, setCustomWater] = useState("");

  // Supplements
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [loggedSupplementIds, setLoggedSupplementIds] = useState<Set<string>>(new Set());
  const [showSuppForm, setShowSuppForm] = useState(false);
  const [suppName, setSuppName] = useState("");
  const [suppDose, setSuppDose] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [saveFavorite, setSaveFavorite] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const uid = userData.user.id;

    const [g, l] = await Promise.all([
      getActiveGoal(supabase, uid),
      getTodayFoodLogs(supabase, uid),
    ]);
    setGoal(g);
    setLogs(l);

    const { data: foods } = await supabase
      .from("foods")
      .select("*")
      .eq("user_id", uid)
      .order("is_favorite", { ascending: false })
      .order("id", { ascending: false })
      .limit(10);
    setRecents(foods ?? []);

    const today = new Date().toISOString().slice(0, 10);

    const { data: profile } = await supabase.from("profiles").select("daily_water_target_ml").eq("id", uid).single();
    setWaterTarget(profile?.daily_water_target_ml ?? 3000);

    const { data: waterRows } = await supabase.from("water_logs").select("ml").eq("user_id", uid).eq("logged_at", today);
    setWaterMl((waterRows ?? []).reduce((sum, r) => sum + r.ml, 0));

    const { data: supps } = await supabase.from("supplements").select("*").eq("user_id", uid).order("name");
    setSupplements(supps ?? []);

    const { data: suppLogs } = await supabase
      .from("supplement_logs").select("supplement_id").eq("user_id", uid).eq("logged_at", today);
    setLoggedSupplementIds(new Set((suppLogs ?? []).map((r) => r.supplement_id)));

    setLoading(false);
  }

  async function addWater(ml: number) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user || ml <= 0) return;
    const { error } = await supabase.from("water_logs").insert({ user_id: userData.user.id, ml });
    if (!error) setWaterMl((w) => w + ml);
  }

  async function updateWaterTarget(ml: number) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user || ml <= 0) return;
    setWaterTarget(ml);
    await supabase.from("profiles").update({ daily_water_target_ml: ml }).eq("id", userData.user.id);
  }

  async function addSupplement() {
    if (!suppName.trim() || !suppDose.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase
      .from("supplements")
      .insert({ user_id: userData.user.id, name: suppName.trim(), dose: suppDose.trim() })
      .select().single();
    if (data) setSupplements((s) => [...s, data]);
    setSuppName(""); setSuppDose(""); setShowSuppForm(false);
  }

  async function deleteSupplement(id: string) {
    await supabase.from("supplements").delete().eq("id", id);
    setSupplements((s) => s.filter((x) => x.id !== id));
  }

  async function toggleSupplementLog(supp: Supplement) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const today = new Date().toISOString().slice(0, 10);
    const already = loggedSupplementIds.has(supp.id);

    if (already) {
      await supabase.from("supplement_logs").delete()
        .eq("supplement_id", supp.id).eq("user_id", userData.user.id).eq("logged_at", today);
      setLoggedSupplementIds((s) => { const next = new Set(s); next.delete(supp.id); return next; });
    } else {
      await supabase.from("supplement_logs").insert({
        supplement_id: supp.id, user_id: userData.user.id, logged_at: today,
      });
      setLoggedSupplementIds((s) => new Set(s).add(supp.id));
    }
  }

  function resetForm() {
    setName(""); setCalories(""); setProtein(""); setCarbs(""); setFat("");
    setSaveFavorite(false); setCustomFields([]);
  }

  function addCustomField() {
    setCustomFields((f) => [...f, { key: "", value: "" }]);
  }
  function updateCustomField(i: number, patch: Partial<CustomField>) {
    setCustomFields((f) => f.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function removeCustomField(i: number) {
    setCustomFields((f) => f.filter((_, idx) => idx !== i));
  }

  async function logFood() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setSaving(false); return; }

    const cf = Object.fromEntries(
      customFields.filter((c) => c.key.trim()).map((c) => [c.key.trim(), Number(c.value) || 0])
    );

    const payload = {
      user_id: userData.user.id,
      name: name.trim(),
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      custom_fields: cf,
    };

    const { data: log } = await supabase.from("food_logs").insert(payload).select().single();
    if (log) setLogs((l) => [log, ...l]);

    if (saveFavorite) {
      const { data: fav } = await supabase.from("foods").insert({ ...payload, is_favorite: true }).select().single();
      if (fav) setRecents((r) => [fav, ...r]);
    }

    setSaving(false);
    setShowForm(false);
    resetForm();
  }

  async function quickAdd(food: Food) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const payload = {
      user_id: userData.user.id,
      food_id: food.id,
      name: food.name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      custom_fields: food.custom_fields ?? {},
    };
    const { data: log } = await supabase.from("food_logs").insert(payload).select().single();
    if (log) setLogs((l) => [log, ...l]);
  }

  async function deleteLog(id: string) {
    await supabase.from("food_logs").delete().eq("id", id);
    setLogs((l) => l.filter((row) => row.id !== id));
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  const totals = sumMacros(logs);
  const targets = {
    calories: goal?.target_calories ?? null,
    protein: goal?.target_protein ?? null,
    carbs: goal?.target_carbs ?? null,
    fat: goal?.target_fat ?? null,
  };

  return (
    <div className="max-w-md mx-auto md:max-w-2xl space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-bold text-lg">Food</h1>
        <Link href="/food/goal" className="text-xs text-acc font-semibold">
          {goal ? `${GOAL_LABEL[goal.goal_type]} · ${daysLeft(goal)}d left` : "Set a goal"}
        </Link>
      </div>

      {/* Today's totals */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <p className="font-semibold text-sm mb-3">Today</p>
        <div className="grid grid-cols-4 gap-2 text-center">
          {([
            ["Cal", totals.calories, targets.calories],
            ["Protein", totals.protein, targets.protein],
            ["Carbs", totals.carbs, targets.carbs],
            ["Fat", totals.fat, targets.fat],
          ] as const).map(([label, val, target]) => (
            <div key={label}>
              <p className="font-bold text-sm">{Math.round(val)}</p>
              {target ? (
                <>
                  <div className="h-1.5 bg-zinc-800 rounded-full mt-1 mb-1">
                    <div
                      className={`h-1.5 rounded-full ${val > target ? "bg-acc" : "bg-acc2"}`}
                      style={{ width: `${Math.min(100, (val / target) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-zinc-500">/ {target}</p>
                </>
              ) : (
                <p className="text-[9px] text-zinc-600 mt-1">{label}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Water */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="font-semibold text-sm">Water</p>
          <button
            onClick={() => {
              const next = prompt("Daily water target (ml)", String(waterTarget));
              if (next && Number(next) > 0) updateWaterTarget(Number(next));
            }}
            className="text-[10px] text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1 hover:bg-zinc-700"
          >
            {waterMl} / {waterTarget} ml ✎
          </button>
        </div>
        <div className="h-2 rounded-full bg-zinc-800 mb-3">
          <div
            className="h-2 rounded-full bg-blue-500"
            style={{ width: `${Math.min(100, (waterMl / waterTarget) * 100)}%` }}
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => addWater(250)} className="flex-1 text-xs py-1.5 rounded-lg bg-zinc-800">+250ml</button>
          <button onClick={() => addWater(500)} className="flex-1 text-xs py-1.5 rounded-lg bg-zinc-800">+500ml</button>
          <input
            className="w-16 bg-zinc-800 rounded-lg text-xs text-center"
            placeholder="ml"
            type="number"
            value={customWater}
            onChange={(e) => setCustomWater(e.target.value)}
          />
          <button
            onClick={() => { addWater(Number(customWater)); setCustomWater(""); }}
            className="px-3 text-xs rounded-lg bg-zinc-800"
          >
            Add
          </button>
        </div>
      </div>

      {/* Supplements */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="font-semibold text-sm">Supplements</p>
          <button onClick={() => setShowSuppForm((v) => !v)} className="text-[11px] text-acc2">+ Add</button>
        </div>

        {showSuppForm && (
          <div className="flex gap-2 mb-3">
            <input className="flex-1 bg-zinc-800 rounded-lg px-2 py-1.5 text-xs" placeholder="Name" value={suppName} onChange={(e) => setSuppName(e.target.value)} />
            <input className="w-20 bg-zinc-800 rounded-lg px-2 py-1.5 text-xs" placeholder="Dose" value={suppDose} onChange={(e) => setSuppDose(e.target.value)} />
            <button onClick={addSupplement} className="px-3 text-xs rounded-lg bg-acc2 text-white">Save</button>
          </div>
        )}

        <div className="space-y-1.5">
          {supplements.map((s) => {
            const done = loggedSupplementIds.has(s.id);
            return (
              <div key={s.id} className="flex items-center justify-between py-1 text-xs">
                <span>{s.name} · {s.dose}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleSupplementLog(s)}
                    className={`w-5 h-5 rounded-md flex items-center justify-center ${
                      done ? "bg-acc2 text-white" : "border border-zinc-700"
                    }`}
                  >
                    {done && "✓"}
                  </button>
                  <button onClick={() => deleteSupplement(s.id)} className="text-zinc-600 hover:text-acc">✕</button>
                </div>
              </div>
            );
          })}
          {!supplements.length && <p className="text-xs text-zinc-600">No supplements added yet.</p>}
        </div>
      </div>

      {/* Recent / favorites quick-add */}
      {recents.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-500 mb-2">Quick add</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recents.map((f) => (
              <button
                key={f.id}
                onClick={() => quickAdd(f)}
                className="shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-left"
              >
                <p className="text-xs font-medium">{f.is_favorite ? "⭐ " : ""}{f.name}</p>
                <p className="text-[10px] text-zinc-500">{f.calories} kcal</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add food */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full rounded-2xl p-4 border border-dashed border-zinc-700 text-zinc-500 text-sm hover:border-zinc-500 hover:text-zinc-300"
        >
          + Log food
        </button>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="font-semibold text-sm">Log food</p>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="text-xs text-zinc-500">Close</button>
          </div>
          <input
            className="w-full bg-zinc-800 rounded-xl px-3 py-2.5 text-sm"
            placeholder="Food name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <input className="bg-zinc-800 rounded-xl px-3 py-2.5 text-sm" placeholder="Calories" type="number" value={calories} onChange={(e) => setCalories(e.target.value)} />
            <input className="bg-zinc-800 rounded-xl px-3 py-2.5 text-sm" placeholder="Protein (g)" type="number" value={protein} onChange={(e) => setProtein(e.target.value)} />
            <input className="bg-zinc-800 rounded-xl px-3 py-2.5 text-sm" placeholder="Carbs (g)" type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
            <input className="bg-zinc-800 rounded-xl px-3 py-2.5 text-sm" placeholder="Fat (g)" type="number" value={fat} onChange={(e) => setFat(e.target.value)} />
          </div>

          {customFields.length > 0 && (
            <div className="space-y-2">
              {customFields.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="flex-1 bg-zinc-800 rounded-xl px-3 py-2 text-xs"
                    placeholder="Field (e.g. Fiber)"
                    value={c.key}
                    onChange={(e) => updateCustomField(i, { key: e.target.value })}
                  />
                  <input
                    className="w-20 bg-zinc-800 rounded-xl px-3 py-2 text-xs"
                    placeholder="Value"
                    type="number"
                    value={c.value}
                    onChange={(e) => updateCustomField(i, { value: e.target.value })}
                  />
                  <button onClick={() => removeCustomField(i)} className="text-acc text-xs px-1">✕</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={addCustomField} className="text-[11px] text-zinc-500">+ Add custom field</button>

          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" checked={saveFavorite} onChange={(e) => setSaveFavorite(e.target.checked)} />
            Save as favorite for quick-add
          </label>

          <button
            onClick={logFood}
            disabled={saving || !name.trim()}
            className="w-full rounded-2xl py-3 font-bold text-sm text-white bg-acc disabled:opacity-50"
          >
            {saving ? "Logging…" : "Log it"}
          </button>
        </div>
      )}

      {/* Today's log */}
      <div>
        <p className="text-xs font-semibold text-zinc-500 mb-2">Today's log</p>
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">{l.name}</p>
                <p className="text-[10px] text-zinc-500">
                  {l.calories} kcal · P{l.protein} C{l.carbs} F{l.fat}
                  {Object.keys(l.custom_fields ?? {}).length > 0 &&
                    " · " + Object.entries(l.custom_fields).map(([k, v]) => `${k} ${v}`).join(", ")}
                </p>
              </div>
              <button onClick={() => deleteLog(l.id)} className="text-zinc-600 hover:text-acc text-xs">✕</button>
            </div>
          ))}
          {!logs.length && <p className="text-xs text-zinc-600">Nothing logged yet today.</p>}
        </div>
      </div>
    </div>
  );
}
