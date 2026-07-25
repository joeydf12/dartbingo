import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth.js";
import { AuthSheet } from "../auth/AuthSheet.jsx";

export function AdminPanel() {
  const { session, user, profile, loading } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [okId, setOkId] = useState(null);
  const [pwdDraft, setPwdDraft] = useState({});
  const [showAuth, setShowAuth] = useState(false);

  async function loadUsers() {
    setError("");
    try {
      const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Kon gebruikers niet laden.");
      setUsers(j.users);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    if (profile?.is_admin) loadUsers();
  }, [profile?.is_admin]);

  async function resetPwd(userId) {
    const pwd = pwdDraft[userId];
    if (!pwd || pwd.length < 6) {
      setError("Wachtwoord moet minimaal 6 tekens zijn.");
      return;
    }
    setBusyId(userId);
    setError("");
    setOkId(null);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId, newPassword: pwd }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Kon wachtwoord niet wijzigen.");
      setOkId(userId);
      setPwdDraft(d => ({ ...d, [userId]: "" }));
    } catch (e) {
      setError(e.message);
    }
    setBusyId(null);
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--mu)" }}>Laden…</div>;

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div className="anto" style={{ fontSize: 24 }}>🛠 ADMIN</div>
        <button onClick={() => setShowAuth(true)} style={{ padding: "12px 24px", background: "var(--gr)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 900, cursor: "pointer" }}>
          Inloggen
        </button>
        {showAuth && <AuthSheet onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  if (!profile?.is_admin) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 32 }}>🚫</div>
        <div style={{ fontWeight: 800 }}>Geen adminrechten voor {user.email}</div>
        <a href="/" style={{ color: "var(--gr)", fontWeight: 700 }}>← Terug naar Dart Bingo</a>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "20px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div className="anto" style={{ fontSize: 22 }}>🛠 ADMIN — GEBRUIKERS</div>
          <a href="/" style={{ color: "var(--mu)", fontSize: 13, fontWeight: 700 }}>← Dart Bingo</a>
        </div>
        {error && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 16, background: "#fff5f5", border: "1px solid #fbbfbf", borderRadius: 8, padding: "10px 14px" }}>⚠️ {error}</div>}
        {!users && !error && <div style={{ color: "var(--mu)" }}>Gebruikers laden…</div>}
        {users && users.length === 0 && <div style={{ color: "var(--mu)" }}>Nog geen accounts.</div>}
        {users && users.map(u => (
          <div key={u.id} style={{ background: "#fff", border: "1.5px solid var(--bd)", borderRadius: 14, padding: "14px 16px", marginBottom: 10, boxShadow: "var(--sh-sm)" }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 800 }}>
                {u.email}
                {u.is_admin && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--gr)" }}>ADMIN</span>}
              </div>
              <div style={{ fontSize: 11, color: "var(--mu)" }}>
                {u.display_name || "—"} · sinds {new Date(u.created_at).toLocaleDateString("nl-NL")}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="password" placeholder="Nieuw wachtwoord (min. 6 tekens)" value={pwdDraft[u.id] || ""}
                onChange={e => setPwdDraft(d => ({ ...d, [u.id]: e.target.value }))} className="inp" style={{ flex: 1 }} />
              <button onClick={() => resetPwd(u.id)} disabled={busyId === u.id}
                style={{ padding: "0 16px", background: okId === u.id ? "var(--gr)" : "var(--gr-lt)", border: "1.5px solid var(--gr)", borderRadius: 10, color: okId === u.id ? "#fff" : "var(--gr-dk)", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                {busyId === u.id ? "…" : okId === u.id ? "✓ Gewijzigd" : "Wachtwoord wijzigen"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
