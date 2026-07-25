import { requireAdmin } from "../_lib/requireAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const check = await requireAdmin(req);
  if (check.error) {
    res.status(check.status).json({ error: check.error });
    return;
  }
  const { admin } = check;
  const { userId, newPassword } = req.body || {};
  if (!userId || !newPassword || String(newPassword).length < 6) {
    res.status(400).json({ error: "Ongeldige invoer (wachtwoord min. 6 tekens)." });
    return;
  }
  try {
    const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) throw error;
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Serverfout." });
  }
}
