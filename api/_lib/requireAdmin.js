import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Verifies the caller's Supabase auth token and confirms they're an admin
// (profiles.is_admin) before handing back a service-role client. The
// service-role key only ever lives here, server-side — never in the bundle.
export async function requireAdmin(req) {
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return { error: "Server niet correct geconfigureerd (ontbrekende env vars).", status: 500 };
  }
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { error: "Niet ingelogd.", status: 401 };

  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error: uerr } = await anon.auth.getUser(token);
  const user = data?.user;
  if (uerr || !user) return { error: "Ongeldige sessie.", status: 401 };

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return { error: "Geen adminrechten.", status: 403 };

  return { admin, user };
}
