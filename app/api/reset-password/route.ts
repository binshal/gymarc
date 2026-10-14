import { NextResponse } from "next/server";
import { supabaseAdmin, usernameToEmail } from "@/lib/supabase-admin";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 10;

export async function POST(req: Request) {
  const { username, recoveryCode, newPassword } = await req.json();
  if (!username || !recoveryCode || !newPassword || newPassword.length < 4) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, recovery_code, reset_attempts, reset_locked_until")
    .eq("username", username.trim().toLowerCase())
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Invalid username or code." }, { status: 400 });
  }

  if (profile.reset_locked_until && new Date(profile.reset_locked_until) > new Date()) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  if (profile.recovery_code !== recoveryCode) {
    const attempts = profile.reset_attempts + 1;
    const locked = attempts >= MAX_ATTEMPTS;
    await admin
      .from("profiles")
      .update({
        reset_attempts: locked ? 0 : attempts,
        reset_locked_until: locked
          ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
          : null,
      })
      .eq("id", profile.id);
    return NextResponse.json({ error: "Invalid username or code." }, { status: 400 });
  }

  await admin.auth.admin.updateUserById(profile.id, { password: newPassword });
  await admin.from("profiles").update({ reset_attempts: 0, reset_locked_until: null }).eq("id", profile.id);

  return NextResponse.json({ ok: true });
}
