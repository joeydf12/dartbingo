import { createClient } from "@supabase/supabase-js";

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const sb = createClient(SB_URL, SB_KEY);

export function dbg(t, m) {
  if (localStorage.getItem("db1") === "1") console.log(`[DB:${t}]`, m);
}
export function err(t, e) {
  console.error(`[ERR:${t}]`, e);
}
