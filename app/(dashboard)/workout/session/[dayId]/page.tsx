"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { uid } from "@/lib/uid";
import type { DayExercise, Exercise, WorkoutSet } from "@/lib/types";

type SetDraft = {
  id: string;        // local key
  dbId: string | null; // row id once saved, so we can undo
  weight: number;
  reps: number;
  set_type: WorkoutSet["set_type"];
  saved: boolean;
  isPr: boolean;
};

const DEFAULT_REST = 90;

export default function ActiveWorkoutPage() {
  const { dayId } = useParams<{ dayId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const copyParam = searchParams.get("copy");
  const supabase = supabaseBrowser();

  const [dayName, setDayName] = useState("");
  const [exercises, setExercises] = useState<DayExercise[]>([]);
  const [alternates, setAlternates] = useState<DayExercise[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [setsByExercise, setSetsByExercise] = useState<Record<string, SetDraft[]>>({});
  const [restSeconds, setRestSeconds] = useState<Record<string, number>>({}); // per exercise
  const [lastSessionText, setLastSessionText] = useState<Record<string, string>>({});
  const [bestWeight, setBestWeight] = useState<Record<string, number>>({});
  const [restLeft, setRestLeft] = useState(0);
  const [restingExercise, setRestingExercise] = useState<string | null>(null);
  const [showAlternates, setShowAlternates] = useState(false);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [librarySearch, setLibrarySearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    init();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [dayId]);

  useEffect(() => {
    if (restLeft <= 0) return;
    timerRef.current = setInterval(() => setRestLeft((s) => Math.max(0, s - 1)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [restLeft > 0]);

  async function init() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: day } = await supabase.from("split_days").select("name").eq("id", dayId).single();
    setDayName(day?.name ?? "Workout");

    const { data: dx } = await supabase
      .from("day_exercises").select("*, exercise:exercises(*)").eq("split_day_id", dayId).order("sort_order");
    const all = (dx as any as DayExercise[]) ?? [];
    setExercises(all.filter((e) => !e.is_alternate));
    setAlternates(all.filter((e) => e.is_alternate));
    setRestSeconds(Object.fromEntries(all.map((e) => [e.exercise_id, DEFAULT_REST])));

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { data: existing } = await supabase
      .from("workout_sessions").select("id").eq("user_id", userData.user.id).eq("split_day_id", dayId)
      .is("finished_at", null).gte("started_at", todayStart.toISOString()).maybeSingle();

    let sid = existing?.id as string | undefined;
    if (!sid) {
      const { data: created } = await supabase
        .from("workout_sessions")
        .insert({ user_id: userData.user.id, split_day_id: dayId, day_name: day?.name ?? "Workout" })
        .select("id").single();
      sid = created?.id;
    }
    setSessionId(sid ?? null);

    const lastText: Record<string, string> = {};
    const best: Record<string, number> = {};
    for (const de of all) {
      const { data: prevSets } = await supabase
        .from("workout_sets")
        .select("weight, reps, session_id, workout_sessions!inner(started_at, user_id)")
        .eq("exercise_id", de.exercise_id)
        .eq("workout_sessions.user_id", userData.user.id)
        .order("workout_sessions(started_at)", { ascending: false })
        .limit(10);
      if (prevSets && prevSets.length) {
        const lastSid = prevSets[0].session_id;
        const lastOnly = prevSets.filter((s: any) => s.session_id === lastSid);
        lastText[de.exercise_id] = `Last: ${lastOnly.map((s: any) => `${s.weight}×${s.reps}`).join(", ")}`;
        best[de.exercise_id] = Math.max(...prevSets.map((s: any) => s.weight));
      }
    }
    setLastSessionText(lastText);
    setBestWeight(best);

    const { data: lib } = await supabase
      .from("exercises").select("*").or(`user_id.is.null,user_id.eq.${userData.user.id}`).order("name");
    setLibrary(lib ?? []);

    const mainList = all.filter((e) => !e.is_alternate);
    const altList = all.filter((e) => e.is_alternate);

    const { data: lastDone } = await supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("split_day_id", dayId)
      .eq("is_rest_day", false)
      .not("finished_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLastSessionId(lastDone?.id ?? null);

    if (copyParam) await copyFromSession(copyParam, mainList, altList);

    setLoading(false);
  }

  // Pre-fills unsaved sets from a past session. Nothing is logged until you
  // tick each set, so you can adjust the numbers first. Exercises from that
  // session that aren't on today's day are added for this session only.
  async function copyFromSession(sourceId: string, mainList: DayExercise[], altList: DayExercise[]) {
    const { data } = await supabase
      .from("workout_sets")
      .select("exercise_id, weight, reps, set_type, set_number, exercise:exercises(id, name, muscle_group)")
      .eq("session_id", sourceId)
      .order("set_number");
    const rows = (data as any[]) ?? [];
    if (!rows.length) return;

    const byExercise = new Map<string, any[]>();
    rows.forEach((r) => {
      if (!byExercise.has(r.exercise_id)) byExercise.set(r.exercise_id, []);
      byExercise.get(r.exercise_id)!.push(r);
    });

    const nextMain = [...mainList];
    let nextAlt = [...altList];
    const newRest: Record<string, number> = {};
    byExercise.forEach((exRows, exId) => {
      if (nextMain.some((e) => e.exercise_id === exId)) return;
      const fromAlt = nextAlt.find((a) => a.exercise_id === exId);
      if (fromAlt) {
        nextAlt = nextAlt.filter((a) => a.id !== fromAlt.id);
        nextMain.push(fromAlt);
      } else {
        nextMain.push({
          id: uid(), split_day_id: dayId, exercise_id: exId,
          sort_order: nextMain.length, is_alternate: false, exercise: exRows[0].exercise,
        });
      }
      newRest[exId] = DEFAULT_REST;
    });

    setExercises(nextMain);
    setAlternates(nextAlt);
    setRestSeconds((r) => ({ ...newRest, ...r }));
    setSetsByExercise((prev) => {
      const next = { ...prev };
      byExercise.forEach((exRows, exId) => {
        if ((next[exId] ?? []).length) return; // don't overwrite sets already there
        next[exId] = exRows.map((r) => ({
          id: uid(), dbId: null, weight: r.weight, reps: r.reps,
          set_type: r.set_type, saved: false, isPr: false,
        }));
      });
      return next;
    });
    setCopied(true);
  }

  function addSetRow(exerciseId: string) {
    setSetsByExercise((prev) => {
      const rows = prev[exerciseId] ?? [];
      const last = rows[rows.length - 1];
      return {
        ...prev,
        [exerciseId]: [...rows, {
          id: uid(), dbId: null,
          weight: last?.weight ?? 0, reps: last?.reps ?? 0,
          set_type: "working", saved: false, isPr: false,
        }],
      };
    });
  }

  function updateSet(exerciseId: string, id: string, patch: Partial<SetDraft>) {
    setSetsByExercise((prev) => ({
      ...prev,
      [exerciseId]: prev[exerciseId].map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }

  async function completeSet(exerciseId: string, id: string) {
    const row = setsByExercise[exerciseId].find((s) => s.id === id);
    if (!row || !sessionId) return;
    const isPr = row.set_type === "working" && row.weight > (bestWeight[exerciseId] ?? 0);

    const { data } = await supabase.from("workout_sets").insert({
      session_id: sessionId,
      exercise_id: exerciseId,
      set_number: setsByExercise[exerciseId].filter((s) => s.saved).length + 1,
      weight: row.weight,
      reps: row.reps,
      set_type: row.set_type,
      is_pr: isPr,
    }).select("id").single();

    if (isPr) setBestWeight((b) => ({ ...b, [exerciseId]: row.weight }));
    updateSet(exerciseId, id, { saved: true, isPr, dbId: data?.id ?? null });
    setRestingExercise(exerciseId);
    setRestLeft(restSeconds[exerciseId] ?? DEFAULT_REST);
  }

  async function undoSet(exerciseId: string, id: string) {
    const row = setsByExercise[exerciseId].find((s) => s.id === id);
    if (!row) return;
    if (row.dbId) await supabase.from("workout_sets").delete().eq("id", row.dbId);
    updateSet(exerciseId, id, { saved: false, isPr: false, dbId: null });
    if (restingExercise === exerciseId) { setRestLeft(0); setRestingExercise(null); }
  }

  function addAlternate(de: DayExercise) {
    setExercises((e) => [...e, de]);
    setAlternates((a) => a.filter((x) => x.id !== de.id));
    setRestSeconds((r) => ({ ...r, [de.exercise_id]: DEFAULT_REST }));
    setShowAlternates(false);
  }

  // Adds any exercise from the full library on the fly — not just ones
  // pre-configured for this day. Saved to day_exercises (as an alternate)
  // so it's there next time too, and added to this session immediately.
  async function addFromLibrary(ex: Exercise) {
    const { data } = await supabase
      .from("day_exercises")
      .insert({ split_day_id: dayId, exercise_id: ex.id, sort_order: exercises.length + alternates.length, is_alternate: true })
      .select("*, exercise:exercises(*)").single();
    if (data) {
      setExercises((e) => [...e, data as any]);
      setRestSeconds((r) => ({ ...r, [ex.id]: DEFAULT_REST }));
    }
    setLibrarySearch("");
    setShowAlternates(false);
  }

  async function removeExerciseFromSession(exerciseId: string, dayExerciseId: string) {
    if ((setsByExercise[exerciseId] ?? []).some((s) => s.saved)) {
      if (!confirm("This exercise has logged sets. Remove it anyway? The logged sets stay in your history.")) return;
    }
    setExercises((e) => e.filter((x) => x.id !== dayExerciseId));
  }

  async function finishWorkout() {
    if (sessionId) {
      await supabase.from("workout_sessions").update({ finished_at: new Date().toISOString() }).eq("id", sessionId);
    }
    router.push("/feed");
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="max-w-md mx-auto md:max-w-2xl space-y-4 pb-24">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-xs text-zinc-500">Session</p>
          <h1 className="font-bold text-lg">{dayName}</h1>
        </div>
        {restLeft > 0 && (
          <span className="text-xs px-3 py-1.5 rounded-lg bg-acc/15 text-acc font-mono">
            ⏱ {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, "0")}
          </span>
        )}
      </div>

      {lastSessionId && !copied && Object.values(setsByExercise).every((r) => r.length === 0) && (
        <button
          onClick={() => copyFromSession(lastSessionId, exercises, alternates)}
          className="w-full rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-acc/50 p-4 text-left"
        >
          <p className="text-sm font-semibold">Copy your last {dayName} workout</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Pre-fills the same exercises, weights and reps. Nothing is logged until you tick each set.
          </p>
        </button>
      )}

      {exercises.map((de) => {
        const rows = setsByExercise[de.exercise_id] ?? [];
        return (
          <div key={de.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-sm">{de.exercise?.name}</p>
                {lastSessionText[de.exercise_id] && (
                  <p className="text-[10px] text-zinc-500 mt-0.5">{lastSessionText[de.exercise_id]}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-zinc-500">Rest</span>
                  <input
                    type="number"
                    className="w-12 bg-zinc-800 rounded-lg text-center text-xs py-1"
                    value={restSeconds[de.exercise_id] ?? DEFAULT_REST}
                    onChange={(e) =>
                      setRestSeconds((r) => ({ ...r, [de.exercise_id]: Number(e.target.value) }))
                    }
                  />
                  <span className="text-[10px] text-zinc-500">s</span>
                </div>
                <button
                  onClick={() => removeExerciseFromSession(de.exercise_id, de.id)}
                  className="text-zinc-600 hover:text-acc text-xs"
                  title="Remove from today's session"
                >
                  ✕
                </button>
              </div>
            </div>

            {rows.length > 0 && (
              <div className="grid grid-cols-[16px_minmax(0,1.2fr)_minmax(0,1fr)_28px] gap-1.5 text-[9px] text-zinc-600 px-1 uppercase tracking-wide">
                <span>#</span><span>Weight</span><span>Reps</span><span></span>
              </div>
            )}

            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={row.id} className="bg-zinc-800/50 rounded-xl p-2 space-y-1.5">
                  <div className="grid grid-cols-[16px_minmax(0,1.2fr)_minmax(0,1fr)_28px] gap-1.5 items-center">
                    <span className="text-xs text-zinc-500">{i + 1}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="min-w-0 w-full bg-zinc-800 rounded-lg px-1 py-2 text-center text-sm disabled:opacity-60"
                      value={row.weight || ""}
                      disabled={row.saved}
                      onChange={(e) => updateSet(de.exercise_id, row.id, { weight: Number(e.target.value) })}
                    />
                    <div className="min-w-0 flex items-center bg-zinc-800 rounded-lg justify-between">
                      <button
                        disabled={row.saved}
                        onClick={() => updateSet(de.exercise_id, row.id, { reps: Math.max(0, row.reps - 1) })}
                        className="w-6 shrink-0 text-zinc-500 disabled:opacity-40"
                      >−</button>
                      <input
                        type="number"
                        className="min-w-0 w-full bg-transparent text-center text-sm disabled:opacity-60"
                        value={row.reps || ""}
                        disabled={row.saved}
                        onChange={(e) => updateSet(de.exercise_id, row.id, { reps: Number(e.target.value) })}
                      />
                      <button
                        disabled={row.saved}
                        onClick={() => updateSet(de.exercise_id, row.id, { reps: row.reps + 1 })}
                        className="w-6 shrink-0 text-zinc-500 disabled:opacity-40"
                      >+</button>
                    </div>
                    <button
                      onClick={() => (row.saved ? undoSet(de.exercise_id, row.id) : completeSet(de.exercise_id, row.id))}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center justify-self-end shrink-0 ${
                        row.saved ? "bg-acc2 text-white" : "border border-zinc-700"
                      }`}
                      title={row.saved ? "Tap to undo" : "Mark done"}
                    >
                      {row.saved && "✓"}
                    </button>
                  </div>

                  {!row.saved && (
                    <div className="flex gap-1">
                      {(["warmup", "working", "drop", "failure"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => updateSet(de.exercise_id, row.id, { set_type: t })}
                          className={`text-[9px] px-2 py-0.5 rounded-full ${
                            row.set_type === t ? "bg-zinc-700 text-white" : "text-zinc-600"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                  {row.saved && row.isPr && (
                    <p className="text-[10px] font-bold text-acc">🏆 New PR! {row.weight}kg × {row.reps}</p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => addSetRow(de.exercise_id)}
              className="w-full rounded-xl border border-dashed border-zinc-700 py-2 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
            >
              + Add set
            </button>
          </div>
        );
      })}

      <div>
        <button
          onClick={() => setShowAlternates((v) => !v)}
          className="w-full rounded-xl border border-dashed border-zinc-700 py-2.5 text-xs text-zinc-400 hover:border-zinc-500"
        >
          + Add extra or alternate exercise
        </button>
        {showAlternates && (
          <div className="mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-3 space-y-2">
            {alternates.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide px-1">
                  Set up for this day
                </p>
                {alternates.map((de) => (
                  <button
                    key={de.id}
                    onClick={() => addAlternate(de)}
                    className="block w-full text-left px-3 py-2.5 rounded-xl bg-zinc-800/60 text-sm hover:bg-zinc-800"
                  >
                    {de.exercise?.name}
                  </button>
                ))}
              </>
            )}
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide px-1 pt-1">
              Any exercise
            </p>
            <input
              autoFocus
              className="w-full bg-zinc-800 rounded-xl px-3 py-2.5 text-sm"
              placeholder="Search the exercise library…"
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
            />
            <div className="max-h-56 overflow-y-auto space-y-1.5">
              {library
                .filter((ex) => ex.name.toLowerCase().includes(librarySearch.toLowerCase()))
                .filter((ex) => !exercises.some((e) => e.exercise_id === ex.id))
                .slice(0, 20)
                .map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => addFromLibrary(ex)}
                    className="flex justify-between w-full text-left px-3 py-2 rounded-xl bg-zinc-800/60 text-sm hover:bg-zinc-800"
                  >
                    <span>{ex.name}</span>
                    <span className="text-[10px] text-zinc-500">{ex.muscle_group}</span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      <button onClick={finishWorkout} className="w-full rounded-2xl py-3 font-bold text-sm text-white bg-acc2">
        Finish Workout
      </button>
    </div>
  );
}
