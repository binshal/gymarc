import { NextResponse } from "next/server";
import { supabaseAdmin, generateRecoveryCode } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const { data, error } = await supabaseAdmin()
    .from("profiles")
    .select("id, username, recovery_code, is_admin, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ users: data, meId: me.id });
}

export async function POST(req: Request) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const { action, userId, code, password, isAdmin } = await req.json();
  if (!userId) return NextResponse.json({ error: "Missing user." }, { status: 400 });

  const admin = supabaseAdmin();

  if (action === "setCode") {
    const next = code ? String(code) : generateRecoveryCode();
    if (!/^\d{6}$/.test(next)) {
      return NextResponse.json({ error: "Code must be exactly 6 digits." }, { status: 400 });
    }
    // Also clears any reset lockout so the user can try again right away.
    const { error } = await admin
      .from("profiles")
      .update({ recovery_code: next, reset_attempts: 0, reset_locked_until: null })
      .eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, code: next });
  }

  if (action === "setPassword") {
    if (!password || String(password).length < 4) {
      return NextResponse.json({ error: "Password must be 4+ characters." }, { status: 400 });
    }
    const { error } = await admin.auth.admin.updateUserById(userId, { password: String(password) });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "setAdmin") {
    if (userId === me.id) {
      return NextResponse.json({ error: "You can't change your own admin status." }, { status: 400 });
    }
    const { error } = await admin.from("profiles").update({ is_admin: !!isAdmin }).eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    if (userId === me.id) {
      return NextResponse.json({ error: "You can't delete your own account here." }, { status: 400 });
    }
    // Cascades: profile and everything that user logged goes with it.
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
