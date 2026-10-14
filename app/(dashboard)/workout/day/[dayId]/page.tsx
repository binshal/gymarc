"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Exercise, DayExercise } from "@/lib/types";

export default function EditDayPage() {
  const { dayId } = useParams<{ dayId: string }>();
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [dayName, setDayName] = useState("");
  const [dayExercises, setDayExercises] = useState<DayExercise[]>([]);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [dayId]);

  async function load() {
    const { data: day } = await supabase.from("split_days").select("name").eq("id", dayId).single();
    setDayName(day?.name ?? "Day");

    const { data: dx } = await supabase
      .from("day_exercises").select("*, exercise:exercises(*)").eq("split_day_id", dayId).order("sort_order");
    setDayExercises((dx as any) ?? []);

    const { data: userData } = await supabase.auth.getUser();
    const { data: lib } = await supabase
      .from("exercises").select("*").or(`user_id.is.null,user_id.eq.${userData.user?.id}`).order("name");
    setLibrary(lib ?? []);
    setLoading(false);
  }

  async function addExercise(exerciseId: string, isAlternate = false) {
    const { data } = await supabase
      .from("day_exercises")
      .insert({ split_day_id: dayId, exercise_id: exerciseId, sort_order: dayExercises.length, is_alternate: isAlternate })
      .select("*, exercise:exercises(*)").single();
    if (data) setDayExercises((d) => [...d, data as any]);
  }

  async function removeExercise(id: string) {
    await supabase.from("day_exercises").delete().eq("id", id);
    setDayExercises((d) => d.filter((de) => de.id !== id));
  }

  async function toggleAlternate(de: DayExercise) {
    await supabase.from("day_exercises").update({ is_alternate: !de.is_alternate }).eq("id", de.id);
    setDayExercises((d) => d.map((x) => (x.id === de.id ? { ...x, is_alternate: !x.is_alternate } : x)));
  }

  async function createCustomExercise() {
    if (!search.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    const { data } = await supabase.from("exercises").insert({ name: search.trim(), user_id: userData.user?.id }).select().single();
    if (data) { setLibrary((l) => [...l, data]); await addExercise(data.id); setSearch(""); setShowPicker(false); }
  }

  const filtered = library.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));
  const main = dayExercises.filter((d) => !d.is_alternate);
  const alternates = dayExercises.filter((d) => d.is_alternate);

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="max-w-md mx-auto md:max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="text-zinc-500 text-sm">←</button>
        <h1 className="font-bold text-lg">{dayName}</h1>
      </div>

      <div className="space-y-3">
        {main.map((de) => (
          <div key={de.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{de.exercise?.name}</p>
              <p className="text-[10px] text-zinc-500">{de.exercise?.muscle_group ?? "Custom"}</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => toggleAlternate(de)} className="text-[11px] text-zinc-500 hover:text-zinc-300">
                Make alternate
              </button>
              <button onClick={() => removeExercise(de.id)} className="text-[11px] text-acc">Remove</button>
            </div>
          </div>
        ))}

        {!main.length && (
          <p className="text-xs text-zinc-600 px-1">No exercises yet — add some below.</p>
        )}

        {alternates.length > 0 && (
          <>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide pt-2 px-1">Alternates</p>
            {alternates.map((de) => (
              <div key={de.id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                <p className="text-sm">{de.exercise?.name}</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleAlternate(de)} className="text-[11px] text-zinc-500 hover:text-zinc-300">
                    Make primary
                  </button>
                  <button onClick={() => removeExercise(de.id)} className="text-[11px] text-acc">Remove</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {!showPicker ? (
        <button
          onClick={() => setShowPicker(true)}
          className="w-full rounded-2xl p-4 border border-dashed border-zinc-700 text-zinc-500 text-sm hover:border-zinc-500 hover:text-zinc-300"
        >
          + Add exercise
        </button>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Add exercise</p>
            <button onClick={() => { setShowPicker(false); setSearch(""); }} className="text-xs text-zinc-500">Close</button>
          </div>
          <input
            autoFocus
            className="w-full bg-zinc-800 rounded-xl px-3 py-2.5 text-sm"
            placeholder="Search library or type a new name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-72 overflow-y-auto space-y-2">
            {filtered.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between rounded-xl bg-zinc-800/60 px-3 py-2.5">
                <div>
                  <p className="text-sm">{ex.name}</p>
                  <p className="text-[10px] text-zinc-500">{ex.muscle_group}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { addExercise(ex.id, false); setShowPicker(false); setSearch(""); }}
                    className="text-[11px] font-semibold text-white bg-acc2 rounded-lg px-3 py-1.5"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { addExercise(ex.id, true); setShowPicker(false); setSearch(""); }}
                    className="text-[11px] text-zinc-400 rounded-lg px-3 py-1.5 border border-zinc-700"
                  >
                    Alternate
                  </button>
                </div>
              </div>
            ))}
            {search && !filtered.length && (
              <button
                onClick={createCustomExercise}
                className="w-full text-left text-[13px] text-acc2 rounded-xl bg-zinc-800/60 px-3 py-2.5"
              >
                + Create "{search}" as a custom exercise
              </button>
            )}
            {!search && !filtered.length && (
              <p className="text-xs text-zinc-600 px-1">Start typing to search the library.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
