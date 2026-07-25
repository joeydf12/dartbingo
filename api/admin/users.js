import { requireAdmin } from "../_lib/requireAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const check = await requireAdmin(req);
  if (check.error) {
    res.status(check.status).json({ error: check.error });
    return;
  }
  const { admin } = check;
  try {
    const { data: authUsers, error } = await admin.auth.admin.listUsers();
    if (error) throw error;
    const { data: profiles } = await admin.from("profiles").select("id,display_name,is_admin,created_at");
    const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    const users = authUsers.users.map(u => ({
      id: u.id,
      email: u.email,
      created_at: byId[u.id]?.created_at || u.created_at,
      display_name: byId[u.id]?.display_name || null,
      is_admin: byId[u.id]?.is_admin || false,
    }));
    res.status(200).json({ users });
  } catch (e) {
    res.status(500).json({ error: e.message || "Serverfout." });
  }
}
