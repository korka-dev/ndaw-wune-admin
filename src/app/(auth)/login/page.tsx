"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login, loading } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password,   setPassword]   = useState("");
  const [showPwd,    setShowPwd]    = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState("");
  const [visible,    setVisible]    = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    // Succès après réinitialisation de mot de passe (paramètre URL ?reset=ok)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reset") === "ok") {
        setSuccess("Mot de passe réinitialisé avec succès. Vous pouvez vous connecter.");
      }
    }
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const { mustChangePassword } = await login(identifier, password);
      router.push(mustChangePassword ? "/change-password" : "/dashboard");
    } catch (err: any) {
      let msg = "Identifiant ou mot de passe incorrect.";
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") {
        msg = detail;
      } else if (Array.isArray(detail)) {
        // Formate élégamment la liste d'erreurs Pydantic
        msg = detail.map((d: any) => d.msg).join(", ");
      } else if (detail && typeof detail === "object") {
        msg = detail.message || JSON.stringify(detail);
      }
      setError(msg);
    }
  }

  return (
    <div className="min-h-screen bg-[#F0E6CA] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">

      {/* Blobs animés */}
      <div className="absolute top-[-80px] right-[-80px] w-72 h-72 rounded-full bg-brand-soft opacity-60 pointer-events-none animate-blob" />
      <div className="absolute bottom-[-60px] left-[-60px] w-56 h-56 rounded-full bg-white opacity-40 pointer-events-none animate-blob animation-delay-2" />
      <div className="absolute top-[55%] right-[5%] w-32 h-32 rounded-full bg-brand-soft opacity-30 pointer-events-none animate-blob animation-delay-4" />

      {/* Card */}
      <div
        className="w-full max-w-[420px] bg-surface rounded-3xl shadow-xl overflow-hidden transition-all duration-700 ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0) scale(1)" : "translateY(32px) scale(0.97)" }}
      >
        {/* Header doré */}
        <div className="bg-brand px-8 py-8 text-center">
          <div
            className="w-16 h-16 rounded-full border-2 border-white/40 bg-white flex items-center justify-center mx-auto mb-4 transition-all duration-700 delay-200"
            style={{ opacity: visible ? 1 : 0, transform: visible ? "scale(1)" : "scale(0.7)" }}
          >
            <img src="/logo-full.png" alt="ARED" className="w-11 h-11 object-contain" />
          </div>
          <div
            className="transition-all duration-700 delay-300"
            style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(10px)" }}
          >
            <h1 className="text-2xl font-bold text-white mb-1">Connexion</h1>
            <p className="text-white/70 text-sm">Tableau de bord Ndaw Wune</p>
          </div>
        </div>

        {/* Body */}
        <div
          className="px-8 py-7 transition-all duration-700 delay-[400ms]"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)" }}
        >
          {success && (
            <div className="bg-success-soft text-success rounded-xl px-4 py-3 text-sm mb-5 flex gap-2 items-start">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0"><path d="M5 12l5 5 9-11"/></svg>
              <span>{success}</span>
            </div>
          )}

          {error && (
            <div className="bg-danger-soft text-danger rounded-xl px-4 py-3 text-sm mb-5 flex gap-2 items-start">
              <span className="mt-0.5">⚠</span><span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-tx mb-1.5">Téléphone ou e-mail</label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                required
                autoComplete="username"
                placeholder="77 000 00 00 ou votre@email.com"
                className="w-full bg-surface-alt rounded-xl px-4 py-3 text-sm text-tx placeholder:text-tx-dim focus:outline-none focus:ring-2 focus:ring-brand/40 border border-transparent focus:border-brand/30 transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-tx">Mot de passe</label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-brand font-medium hover:underline"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-surface-alt rounded-xl px-4 py-3 pr-16 text-sm text-tx placeholder:text-tx-dim focus:outline-none focus:ring-2 focus:ring-brand/40 border border-transparent focus:border-brand/30 transition"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-tx-muted hover:text-tx transition">
                  {showPwd ? "Masquer" : "Voir"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !identifier || !password}
              className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors text-sm mt-1"
            >
              {loading ? "Connexion en cours…" : "Se connecter"}
            </button>
          </form>
        </div>
      </div>

      <div
        className="transition-all duration-700 delay-500"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <Link href="/" className="mt-6 text-sm text-tx-muted hover:text-tx transition block">
          ← Retour à l'accueil
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
