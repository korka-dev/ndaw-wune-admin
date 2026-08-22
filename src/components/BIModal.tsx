"use client";
/* Modal BI réutilisable — bande de KPI + onglets de graphiques (Donut/BarList/LineChart
   depuis @/components/Charts), utilisé par les pages de gestion (superviseurs, écoles,
   enseignants, classes, élèves) derrière un bouton "Voir les graphes". */
import { useState } from "react";

export interface BIKpi {
  label: string;
  value: React.ReactNode;
  sub?: string;
  color?: string;
}

export interface BITabDef {
  id: string;
  label: string;
  content: React.ReactNode;
}

/* ── Bouton d'ouverture ────────────────────────────────────────────────── */
export function BIButton({ onClick, label = "Voir les graphes" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
      {label}
    </button>
  );
}

/* ── Carte KPI (remplace les anciens cercles inline sur les pages) ───────── */
export function KpiCard({ label, value, sub, color = "text-tx" }: {
  label: string; value: React.ReactNode; sub?: string; color?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl px-5 py-4 text-center">
      <div className={`text-2xl font-bold leading-none ${color}`}>{value}</div>
      <div className="text-xs font-medium text-tx mt-1.5">{label}</div>
      {sub && <div className="text-[11px] text-tx-muted mt-0.5">{sub}</div>}
    </div>
  );
}

/* ── Panneau de graphique (dans le modal) ─────────────────────────────────── */
export function BIPanel({ title, sub, className = "", children }: {
  title: string; sub?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={`bg-surface border border-border rounded-2xl p-5 ${className}`}>
      <div className="mb-4">
        <div className="text-sm font-semibold text-tx">{title}</div>
        {sub && <div className="text-xs text-tx-muted mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

/* ── Modal BI ──────────────────────────────────────────────────────────── */
export function BIModal({ title, subtitle, kpis = [], tabs, onClose }: {
  title: string; subtitle?: string; kpis?: BIKpi[]; tabs: BITabDef[]; onClose: () => void;
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  const activeTab = tabs.find(t => t.id === active) ?? tabs[0];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden">

        {/* En-tête */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border flex-shrink-0 bg-gradient-to-r from-brand/10 to-transparent">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A90C2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-tx truncate">{title}</h2>
              {subtitle && <p className="text-xs text-tx-muted truncate">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-alt text-tx-muted transition-colors flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Bande KPI */}
        {kpis.length > 0 && (
          <div
            className="grid gap-3 px-6 py-4 border-b border-border flex-shrink-0 bg-surface-alt/30"
            style={{ gridTemplateColumns: `repeat(${Math.min(kpis.length, 6)}, minmax(0,1fr))` }}
          >
            {kpis.map(k => (
              <div key={k.label} className="text-center">
                <div className={`text-xl font-bold ${k.color ?? "text-tx"}`}>{k.value}</div>
                <div className="text-[10px] text-tx-muted mt-0.5 uppercase tracking-wide">{k.label}</div>
                {k.sub && <div className="text-[10px] text-tx-muted/70">{k.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Onglets */}
        {tabs.length > 1 && (
          <div className="flex items-center gap-1 px-6 pt-2 border-b border-border flex-shrink-0 overflow-x-auto">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
                  (active ?? tabs[0].id) === t.id ? "text-brand border-brand" : "text-tx-muted border-transparent hover:text-tx"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab?.content}
        </div>
      </div>
    </div>
  );
}
