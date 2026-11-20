"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

/* ── Icônes inline ──────────────────────────────────────────────────────────── */
const IcoLock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
);

/* ── Page principale ──────────────────────────────────────────────────────────
 * La réinitialisation en libre-service est fermée (rapport V2, APP-01) : elle
 * changeait le mot de passe de n'importe quel compte à partir du seul
 * identifiant. Un mot de passe oublié est réinitialisé par un administrateur
 * (menu Comptes → Réinitialiser), ce qui invalide aussi les anciennes sessions.
 */
export default function ForgotPasswordPage() {
  const [visible, setVisible] = useState(false);

  // Mount animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

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
          <h1 className="text-xl font-bold text-white mb-1">Mot de passe oublié</h1>
          <p className="text-white/70 text-xs">
            La réinitialisation passe par un administrateur
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-7">
          <div className="space-y-4 text-sm text-tx">
            <p>
              Pour des raisons de sécurité, le mot de passe ne peut plus être
              réinitialisé depuis cette page.
            </p>
            <p>
              Contactez un administrateur de la plateforme : il vous attribuera un
              mot de passe temporaire, que vous devrez changer à la prochaine
              connexion.
            </p>
            <Link
              href="/login"
              className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3.5 rounded-xl transition-colors text-sm flex items-center justify-center"
            >
              Retour à la connexion
            </Link>
          </div>
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
