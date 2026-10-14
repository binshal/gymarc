import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabase-admin";

// SERVER-ONLY. Returns the logged-in user if (and only if) they are an
// admin, checked against the database, never against anything the
// browser sends.
export async function requireAdmin() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          /* read-only here */
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabaseAdmin().from("profiles").select("is_admin").eq("id", user.id).single();
  return data?.is_admin ? user : null;
}
