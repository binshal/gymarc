"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Comment } from "@/lib/types";

type FeedSession = {
  id: string;
  user_id: string;
  day_name: string;
  started_at: string;
  finished_at: string;
  profiles: { username: string } | null;
};

type SetRow = {
  id: string;
  session_id: string;
  exercise_id: string;
  weight: number;
  reps: number;
  set_type: string;
  is_pr: boolean;
  exercise: { name: string } | null;
};

export default function FeedPage() {
  const supabase = supabaseBrowser();
  const [myId, setMyId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<FeedSession[]>([]);
  const [setsBySession, setSetsBySession] = useState<Record<string, SetRow[]>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedByMe, setLikedByMe] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setMyId(userData.user.id);

    const { data: s } = await supabase
      .from("workout_sessions")
      .select("id, user_id, day_name, started_at, finished_at, profiles(username)")
      .eq("is_rest_day", false)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(30);
    const rows = (s as any as FeedSession[]) ?? [];
    setSessions(rows);

    const ids = rows.map((r) => r.id);
    if (!ids.length) { setLoading(false); return; }

    const { data: sets } = await supabase
      .from("workout_sets")
      .select("*, exercise:exercises(name)")
      .in("session_id", ids)
      .order("set_number");
    const grouped: Record<string, SetRow[]> = {};
    for (const row of (sets as any as SetRow[]) ?? []) (grouped[row.session_id] ??= []).push(row);
    setSetsBySession(grouped);

    const { data: likes } = await supabase.from("likes").select("session_id, user_id").in("session_id", ids);
    const counts: Record<string, number> = {};
    const mine = new Set<string>();
    (likes ?? []).forEach((l: any) => {
      counts[l.session_id] = (counts[l.session_id] ?? 0) + 1;
      if (l.user_id === userData.user!.id) mine.add(l.session_id);
    });
    setLikeCounts(counts);
    setLikedByMe(mine);

    const { data: commentRows } = await supabase
      .from("comments")
      .select("*, profiles(username)")
      .in("session_id", ids)
      .order("created_at", { ascending: true });
    const commentGroups: Record<string, Comment[]> = {};
    for (const c of (commentRows as any as Comment[]) ?? []) (commentGroups[c.session_id] ??= []).push(c);
    setComments(commentGroups);

    setLoading(false);
  }

  function volumeFor(sets: SetRow[]) {
    return sets.filter((s) => s.set_type !== "warmup").reduce((sum, s) => sum + s.weight * s.reps, 0);
  }

  async function toggleLike(sessionId: string) {
    if (!myId) return;
    if (likedByMe.has(sessionId)) {
      await supabase.from("likes").delete().eq("session_id", sessionId).eq("user_id", myId);
      setLikedByMe((s) => { const n = new Set(s); n.delete(sessionId); return n; });
      setLikeCounts((c) => ({ ...c, [sessionId]: Math.max(0, (c[sessionId] ?? 1) - 1) }));
    } else {
      await supabase.from("likes").insert({ session_id: sessionId, user_id: myId });
      setLikedByMe((s) => new Set(s).add(sessionId));
      setLikeCounts((c) => ({ ...c, [sessionId]: (c[sessionId] ?? 0) + 1 }));
    }
  }

  async function postComment(sessionId: string) {
    const body = (commentDraft[sessionId] ?? "").trim();
    if (!body || !myId) return;
    const { data } = await supabase
      .from("comments").insert({ session_id: sessionId, user_id: myId, body })
      .select("*, profiles(username)").single();
    if (data) setComments((c) => ({ ...c, [sessionId]: [...(c[sessionId] ?? []), data as any] }));
    setCommentDraft((d) => ({ ...d, [sessionId]: "" }));
  }

  async function saveCommentEdit(sessionId: string, commentId: string, body: string) {
    if (!body.trim()) return;
    await supabase.from("comments").update({ body: body.trim() }).eq("id", commentId);
    setComments((c) => ({
      ...c,
      [sessionId]: c[sessionId].map((x) => (x.id === commentId ? { ...x, body: body.trim() } : x)),
    }));
    setEditingComment(null);
  }

  async function deleteComment(sessionId: string, commentId: string) {
    await supabase.from("comments").delete().eq("id", commentId);
    setComments((c) => ({ ...c, [sessionId]: c[sessionId].filter((x) => x.id !== commentId) }));
  }

  async function deletePost(sessionId: string) {
    if (!confirm("Delete this workout from the feed? This removes it and its sets entirely.")) return;
    await supabase.from("workout_sessions").delete().eq("id", sessionId);
    setSessions((s) => s.filter((row) => row.id !== sessionId));
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="max-w-md mx-auto md:max-w-2xl space-y-3">
      <h1 className="font-bold text-lg">Feed</h1>

      {sessions.map((sess) => {
        const sets = setsBySession[sess.id] ?? [];
        const grouped = sets.reduce<Record<string, SetRow[]>>((acc, s) => {
          (acc[s.exercise_id] ??= []).push(s);
          return acc;
        }, {});
        const prCount = sets.filter((s) => s.is_pr).length;
        const isOpen = expanded === sess.id;
        const isMine = sess.user_id === myId;

        return (
          <div key={sess.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Link href={`/feed/u/${sess.profiles?.username}`} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-zinc-700 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold">{sess.profiles?.username ?? "user"}</p>
                    <p className="text-[10px] text-zinc-500">
                      {sess.day_name} · {new Date(sess.finished_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </Link>
                {isMine && (
                  <button onClick={() => deletePost(sess.id)} className="text-[10px] text-acc">Delete</button>
                )}
              </div>

              <button onClick={() => setExpanded(isOpen ? null : sess.id)} className="w-full text-left">
                {isOpen ? (
                  <div className="space-y-2 pt-1">
                    {Object.entries(grouped).map(([exId, exSets]) => (
                      <div key={exId}>
                        <p className="text-xs font-semibold mb-1">{exSets[0].exercise?.name}</p>
                        <div className="space-y-1">
                          {exSets.map((s) => (
                            <div key={s.id} className="flex justify-between text-xs bg-zinc-800/50 rounded-lg px-3 py-1.5">
                              <span>{s.weight}kg × {s.reps} <span className="text-zinc-600">· {s.set_type}</span></span>
                              {s.is_pr && <span className="text-acc">🏆</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-400 pt-1">
                    {Object.values(grouped).map((exSets) => (
                      <span key={exSets[0].exercise_id}>{exSets[0].exercise?.name}</span>
                    ))}
                  </div>
                )}
              </button>

              <div className="flex justify-between items-center text-[10px] text-zinc-500 pt-3 mt-3 border-t border-zinc-800">
                <span>Volume: {volumeFor(sets).toLocaleString()}kg{prCount > 0 && ` · 🏆 ${prCount} PR${prCount > 1 ? "s" : ""}`}</span>
                <div className="flex gap-3 items-center">
                  <button onClick={() => toggleLike(sess.id)} className="flex items-center gap-1">
                    <span>{likedByMe.has(sess.id) ? "❤️" : "🤍"}</span>
                    <span>{likeCounts[sess.id] ?? 0}</span>
                  </button>
                  <button onClick={() => setExpanded(isOpen ? null : sess.id)}>
                    💬 {(comments[sess.id] ?? []).length}
                  </button>
                </div>
              </div>
            </div>

            {isOpen && (
              <div className="border-t border-zinc-800 p-4 space-y-2">
                {(comments[sess.id] ?? []).map((c) => (
                  <div key={c.id} className="text-xs">
                    {editingComment === c.id ? (
                      <div className="flex gap-2">
                        <input
                          defaultValue={c.body}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveCommentEdit(sess.id, c.id, (e.target as HTMLInputElement).value);
                          }}
                          className="flex-1 bg-zinc-800 rounded-lg px-2 py-1"
                          id={`edit-${c.id}`}
                        />
                        <button
                          onClick={() => saveCommentEdit(sess.id, c.id, (document.getElementById(`edit-${c.id}`) as HTMLInputElement).value)}
                          className="text-acc2"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start">
                        <p>
                          <span className="font-semibold">{c.profiles?.username ?? "user"}</span>{" "}
                          <span className="text-zinc-400">{c.body}</span>
                        </p>
                        {c.user_id === myId && (
                          <div className="flex gap-2 shrink-0 pl-2">
                            <button onClick={() => setEditingComment(c.id)} className="text-zinc-500">Edit</button>
                            <button onClick={() => deleteComment(sess.id, c.id)} className="text-acc">✕</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex gap-2 pt-1">
                  <input
                    className="flex-1 bg-zinc-800 rounded-lg px-3 py-2 text-xs"
                    placeholder="Add a comment…"
                    value={commentDraft[sess.id] ?? ""}
                    onChange={(e) => setCommentDraft((d) => ({ ...d, [sess.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && postComment(sess.id)}
                  />
                  <button onClick={() => postComment(sess.id)} className="text-xs text-acc2 font-semibold px-2">Post</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {!sessions.length && (
        <p className="text-sm text-zinc-500">No workouts posted yet — finish one to be the first!</p>
      )}
    </div>
  );
}
