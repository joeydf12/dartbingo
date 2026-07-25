import React, { useState } from "react";
import { useAuth } from "./useAuth.js";

export function AuthSheet({ onClose }) {
  const { user, profile, signUp, signIn, signOut } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      if (mode === "login") {
        const { error: e } = await signIn(email, pwd);
        if (e) throw e;
        onClose?.();
      } else {
        const { error: e } = await signUp(email, pwd);
        if (e) throw e;
        setMsg("Account aangemaakt! Check je mail als bevestiging vereist is, log daarna in.");
        setMode("login");
      }
    } catch (e) {
      setError(e.message || "Er ging iets mis.");
    }
    setBusy(false);
  }

  if (user) {
    return (
      <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
        <div className="sheet">
          <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 16 }}>🔐 Account</div>
          <div style={{ fontSize: 14, marginBottom: 8 }}>Ingelogd als <b>{user.email}</b></div>
          {profile?.is_admin && (
            <div style={{ fontSize: 12, color: "var(--gr)", marginBottom: 12 }}>
              Je bent admin — ga naar <a href="/admin">/admin</a>
            </div>
          )}
          <button onClick={async () => { await signOut(); onClose?.(); }}
            style={{ width: "100%", padding: "12px 0", background: "transparent", border: "1.5px solid var(--bd)", borderRadius: 10, color: "var(--mu)", fontWeight: 800, marginBottom: 8, cursor: "pointer" }}>
            Uitloggen
          </button>
          <button onClick={onClose} style={{ width: "100%", padding: "12px 0", background: "var(--gr)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 900, cursor: "pointer" }}>
            Sluiten
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="sheet">
        <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 16 }}>🔐 {mode === "login" ? "Inloggen" : "Account aanmaken"}</div>
        <div className="neon-lbl" style={{ marginBottom: 8 }}>E-MAIL</div>
        <input className="inp" style={{ marginBottom: 12 }} value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="jij@voorbeeld.nl" />
        <div className="neon-lbl" style={{ marginBottom: 8 }}>WACHTWOORD</div>
        <input className="inp" style={{ marginBottom: 16 }} value={pwd} onChange={e => setPwd(e.target.value)} type="password" placeholder="••••••••" onKeyDown={e => e.key === "Enter" && submit()} />
        {error && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}
        {msg && <div style={{ color: "var(--gr-dk)", fontSize: 13, marginBottom: 12 }}>{msg}</div>}
        <button onClick={submit} disabled={busy || !email || !pwd}
          style={{ width: "100%", padding: "13px 0", background: "var(--gr)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 900, fontSize: 15, marginBottom: 10, opacity: busy ? .6 : 1, cursor: busy ? "not-allowed" : "pointer" }}>
          {busy ? "…" : mode === "login" ? "Inloggen" : "Account aanmaken"}
        </button>
        <button onClick={() => setMode(mode === "login" ? "register" : "login")}
          style={{ width: "100%", padding: "10px 0", background: "transparent", border: "none", color: "var(--mu)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          {mode === "login" ? "Nog geen account? Registreren" : "Al een account? Inloggen"}
        </button>
        <button onClick={onClose} style={{ width: "100%", padding: "10px 0", background: "transparent", border: "1.5px solid var(--bd)", borderRadius: 10, color: "var(--mu)", fontWeight: 800, marginTop: 8, cursor: "pointer" }}>
          Sluiten
        </button>
      </div>
    </div>
  );
}
