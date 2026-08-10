"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/cookies";

export default function ChangePasswordPage() {
  const { logout } = useAuth();
  const router = useRouter();

  const [newPwd,   setNewPwd]   = useState("");
  const [confPwd,  setConfPwd]  = useState("");
  const [showNew,  setShowNew]  = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(false);

  useEffect(() => {
    // Le token vit dans un cookie (lib/cookies.ts), plus dans localStorage
    // depuis la migration de stockage — cette page en était restée à l'ancien
    // système et renvoyait donc systématiquement vers /login.
    if (!getAccessToken()) router.replace("/login");
  }, []);

  const isValid = newPwd.length > 0 && newPwd === confPwd;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/change-password", { new_password: newPwd, confirm_password: confPwd });
      setSuccess(true);
      setTimeout(() => { logout(); router.replace("/login"); }, 2000);
    } catch (err: any) {
      let msg = "Une erreur est survenue.";
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") {
        msg = detail;
      } else if (Array.isArray(detail)) {
        msg = detail.map((d: any) => d.msg).join(", ");
      } else if (detail && typeof detail === "object") {
        msg = detail.message || JSON.stringify(detail);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="bg-surface rounded-2xl border border-border p-8 w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-success-soft flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2F7D4A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-11"/></svg>
        </div>
        <h2 className="text-lg font-bold text-tx mb-1">Mot de passe mis à jour !</h2>
        <p className="text-tx-muted text-sm">Redirection vers la connexion…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-brand-soft flex items-center justify-center mx-auto mb-4">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8B6F1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          </div>
          <h1 className="text-xl font-bold text-tx">Nouveau mot de passe</h1>
          <p className="text-tx-muted text-sm mt-1.5 leading-relaxed">
            Bienvenue ! Définissez un mot de passe personnel<br/>avant d'accéder à la plateforme.
          </p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-7">
          {error && (
            <div className="bg-danger-soft text-danger rounded-xl px-4 py-3 text-sm mb-5 flex gap-2">
              <span>⚠</span><span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-tx mb-1.5">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Nouveau mot de passe"
                  className="w-full border border-border rounded-xl px-4 py-2.5 pr-16 text-sm text-tx bg-surface placeholder:text-tx-dim focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-tx-muted hover:text-tx transition">
                  {showNew ? "Masquer" : "Voir"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-tx mb-1.5">Confirmer le mot de passe</label>
              <div className="relative">
                <input
                  type={showConf ? "text" : "password"}
                  value={confPwd}
                  onChange={e => setConfPwd(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Répétez le mot de passe"
                  className={`w-full border rounded-xl px-4 py-2.5 pr-16 text-sm text-tx bg-surface placeholder:text-tx-dim focus:outline-none focus:ring-2 focus:ring-primary/40 transition
                    ${confPwd && newPwd !== confPwd ? "border-danger focus:border-danger" : "border-border focus:border-primary"}`}
                />
                <button type="button" onClick={() => setShowConf(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-tx-muted hover:text-tx transition">
                  {showConf ? "Masquer" : "Voir"}
                </button>
              </div>
              {confPwd && newPwd !== confPwd && (
                <p className="text-danger text-xs mt-1">Les mots de passe ne correspondent pas.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!isValid || loading}
              className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              {loading ? "Enregistrement…" : "Enregistrer et se reconnecter"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
