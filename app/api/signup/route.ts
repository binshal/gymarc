import { NextResponse } from "next/server";
import { supabaseAdmin, usernameToEmail, generateRecoveryCode } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  const { username, password } = await req.json();

  if (!username || !password || username.length < 3 || password.length < 4) {
    return NextResponse.json({ error: "Username (3+) and password (4+) required." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const email = usernameToEmail(username);
  const recoveryCode = generateRecoveryCode();

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip email verification entirely
  });

  if (authError) {
    // Supabase returns a conflict if the (fake) email already exists,
    // i.e. the username is taken.
    return NextResponse.json({ error: "Username already taken." }, { status: 409 });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: authUser.user.id,
    username: username.trim().toLowerCase(),
    recovery_code: recoveryCode,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id); // roll back
    return NextResponse.json({ error: "Username already taken." }, { status: 409 });
  }

  // Recovery code is returned ONCE, here. The UI must force the
  // user to acknowledge/save it before continuing.
  return NextResponse.json({ recoveryCode });
}
