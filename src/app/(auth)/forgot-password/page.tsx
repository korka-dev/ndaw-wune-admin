"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";

/* ── Icônes inline ──────────────────────────────────────────────────────────── */
const IcoPhone = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.22 1.18 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.54-.54a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
  </svg>
);
const IcoLock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
);
const IcoCheck = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l5 5 9-11"/>
  </svg>
);

/* ── Critères de sécurité ───────────────────────────────────────────────────── */
const CRITERIA = [
  { label: "Au moins 8 caractères", ok: (v: string) => v.length >= 8 },
  { label: "Au moins une majuscule", ok: (v: string) => /[A-Z]/.test(v) },
  { label: "Au moins un chiffre",    ok: (v: string) => /[0-9]/.test(v) },
];

/* ── Page principale ────────────────────────────────────────────────────────── */
export default function ForgotPasswordPage() {
  const router  = useRouter();
  const [visible, setVisible] = useState(false);

  const [identifier,  setIdentifier]  = useState("");
  const [newPwd,      setNewPwd]      = useState("");
  const [confirmPwd,  setConfirmPwd]  = useState("");
  const [showPwd,     setShowPwd]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  // Mount animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const allCriteriaMet = CRITERIA.every(c => c.ok(newPwd));
  const passwordsMatch = newPwd.length > 0 && newPwd === confirmPwd;
  const canSubmit      = identifier.trim().length > 0 && allCriteriaMet && passwordsMatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.resetPassword(identifier.trim(), newPwd, confirmPwd);
      router.push("/login?reset=ok");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail ?? "Une erreur est survenue. Vérifiez vos informations et réessayez.");
    } finally {
      setLoading(false);
    }
  }

  const cardAnim = {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0) scale(1)" : "translateY(32px) scale(0.97)",
  };

  return (
    <div className="min-h-screen bg-[#F0E6CA] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">

      {/* Blobs décoratifs */}
      <div className="absolute top-[-80px] right-[-80px] w-72 h-72 rounded-full bg-brand-soft opacity-60 pointer-events-none animate-blob" />
      <div className="absolute bottom-[-60px] left-[-60px] w-56 h-56 rounded-full bg-white opacity-40 pointer-events-none animate-blob animation-delay-2" />
      <div className="absolute top-[55%] right-[5%] w-32 h-32 rounded-full bg-brand-soft opacity-30 pointer-events-none animate-blob animation-delay-4" />

      <div
        className="w-full max-w-[420px] bg-surface rounded-3xl shadow-xl overflow-hidden transition-all duration-700 ease-out"
        style={cardAnim}
      >
        {/* Header */}
        <div className="bg-brand px-8 py-7 text-center text-white">
          <div className="w-14 h-14 rounded-full border-2 border-white/40 bg-white/20 flex items-center justify-center mx-auto mb-3">
            <IcoLock />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">Réinitialiser le mot de passe</h1>
          <p className="text-white/70 text-xs">
            Entrez votre identifiant et choisissez un nouveau mot de passe
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-7">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Erreur globale */}
            {error && (
              <div className="bg-danger-soft text-danger rounded-xl px-4 py-3 text-sm flex gap-2 items-start">
                <span className="mt-0.5">⚠</span><span>{error}</span>
              </div>
            )}

            {/* Identifiant */}
            <div>
              <label className="block text-sm font-medium text-tx mb-1.5">
                Téléphone ou e-mail
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted">
                  <IcoPhone />
                </span>
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="77 000 00 00 ou votre@email.com"
                  className="w-full bg-surface-alt rounded-xl pl-11 pr-4 py-3 text-sm text-tx placeholder:text-tx-dim focus:outline-none focus:ring-2 focus:ring-brand/40 border border-transparent focus:border-brand/30 transition"
                />
              </div>
            </div>

            {/* Nouveau mot de passe */}
            <div>
              <label className="block text-sm font-medium text-tx mb-1.5">Nouveau mot de passe</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted"><IcoLock /></span>
                <input
                  type={showPwd ? "text" : "password"}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full bg-surface-alt rounded-xl pl-11 pr-16 py-3 text-sm text-tx placeholder:text-tx-dim focus:outline-none focus:ring-2 focus:ring-brand/40 border border-transparent focus:border-brand/30 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-tx-muted hover:text-tx transition"
                >
                  {showPwd ? "Masquer" : "Voir"}
                </button>
              </div>

              {/* Critères — visibles dès qu'on tape */}
              {newPwd.length > 0 && (
                <div className="mt-2 space-y-1">
                  {CRITERIA.map(c => {
                    const ok = c.ok(newPwd);
                    return (
                      <div key={c.label} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${ok ? "bg-success" : "bg-border"}`}>
                          {ok && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12l5 5 9-11"/>
                            </svg>
                          )}
                        </div>
                        <span className={`text-[11px] transition-colors ${ok ? "text-success font-medium" : "text-tx-muted"}`}>
                          {c.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Confirmer le mot de passe */}
            <div>
              <label className="block text-sm font-medium text-tx mb-1.5">Confirmer le mot de passe</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted"><IcoLock /></span>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={`w-full bg-surface-alt rounded-xl pl-11 pr-16 py-3 text-sm text-tx placeholder:text-tx-dim focus:outline-none focus:ring-2 border transition
                    ${confirmPwd && confirmPwd !== newPwd
                      ? "border-danger/40 focus:ring-danger/30"
                      : "border-transparent focus:ring-brand/40 focus:border-brand/30"
                    }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-tx-muted hover:text-tx transition"
                >
                  {showConfirm ? "Masquer" : "Voir"}
                </button>
              </div>
              {confirmPwd && passwordsMatch && (
                <p className="text-[11px] text-success flex items-center gap-1 mt-1.5">
                  <IcoCheck /> Les mots de passe correspondent
                </p>
              )}
              {confirmPwd && !passwordsMatch && (
                <p className="text-[11px] text-danger mt-1.5">
                  Les mots de passe ne correspondent pas.
                </p>
              )}
            </div>

            {/* Bouton */}
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
            >
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Réinitialisation…</>
                : "Réinitialiser le mot de passe"
              }
            </button>
          </form>
        </div>
      </div>

      {/* Retour */}
      <div className="mt-6 transition-all duration-700" style={{ opacity: visible ? 1 : 0 }}>
        <Link href="/login" className="text-sm text-tx-muted hover:text-tx transition">
          ← Retour à la connexion
        </Link>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(15px, -18px) scale(1.07); }
          66%       { transform: translate(-10px, 10px) scale(0.95); }
        }
        .animate-blob { animation: blob 9s ease-in-out infinite; }
        .animation-delay-2 { animation-delay: 2s; }
        .animation-delay-4 { animation-delay: 4s; }
      `}</style>
    </div>
  );
}
