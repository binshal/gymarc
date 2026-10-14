import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY. Uses the service role key — never import this in client components.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// The "hidden email" trick: Supabase Auth requires an email, so we
// mint a fake, unique, non-deliverable one from the username.
export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@gymarc.internal`;
}

export function generateRecoveryCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}
