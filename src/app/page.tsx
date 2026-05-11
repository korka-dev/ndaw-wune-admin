"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-12 relative overflow-hidden">

      {/* ── Blobs animés ── */}
      <div className="absolute top-[-100px] right-[-100px] w-80 h-80 rounded-full bg-brand-soft opacity-50 pointer-events-none animate-blob" />
      <div className="absolute bottom-[-80px] left-[-80px] w-64 h-64 rounded-full bg-primary-soft opacity-40 pointer-events-none animate-blob animation-delay-2" />
      <div className="absolute top-[35%] left-[5%] w-40 h-40 rounded-full bg-success-soft opacity-25 pointer-events-none animate-blob animation-delay-4" />
      <div className="absolute bottom-[20%] right-[8%] w-28 h-28 rounded-full bg-warn-soft opacity-30 pointer-events-none animate-blob animation-delay-3" />

      {/* ── Contenu ── */}
      <div
        className="w-full max-w-xl text-center z-10 transition-all duration-700 ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)" }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div
            className="w-28 h-28 bg-surface rounded-3xl shadow-xl flex items-center justify-center transition-all duration-700 delay-100"
            style={{ opacity: visible ? 1 : 0, transform: visible ? "scale(1)" : "scale(0.85)" }}
          >
            <img src="/logo-full.png" alt="ARED" className="w-20 h-20 object-contain" />
          </div>
        </div>

        {/* Titre */}
        <div
          className="transition-all duration-700 delay-200"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)" }}
        >
          <h1 className="text-3xl font-bold text-brand mb-2 whitespace-nowrap">
            Bienvenue sur <span className="text-tx">Ndaw Wune</span>
          </h1>
          <p className="text-tx-muted text-sm whitespace-nowrap">
            Votre plateforme de gestion du programme de formation ARED
          </p>
        </div>

        {/* Badge statut */}
        <div
          className="mt-6 mb-10 transition-all duration-700 delay-300"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)" }}
        >
          <div className="inline-flex items-center gap-2 bg-surface border border-border rounded-full px-4 py-1.5 text-sm text-tx">
            <span className="w-2 h-2 rounded-full bg-success inline-block animate-pulse" />
            Système opérationnel
          </div>
        </div>

        {/* CTA */}
        <div
          className="transition-all duration-700 delay-[400ms]"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)" }}
        >
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors shadow-md"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            Se connecter
          </Link>
          <p className="text-tx-dim text-xs mt-4">Réservé au personnel ARED autorisé</p>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(18px, -20px) scale(1.08); }
          66%       { transform: translate(-12px, 12px) scale(0.95); }
        }
        .animate-blob { animation: blob 9s ease-in-out infinite; }
        .animation-delay-2 { animation-delay: 2s; }
        .animation-delay-3 { animation-delay: 3s; }
        .animation-delay-4 { animation-delay: 4s; }
      `}</style>
    </div>
  );
}
