"use client";
import { useEffect, useState } from "react";
import { planningApi, sessionsApi } from "@/lib/api";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const DAYS_PER_PAGE = 3;

interface Seg {
  id: string;
  session_id: string;
  jour: number;
  heure_debut: string;
  heure_fin: string;
  matiere?: string;
}

const EMPTY = { session_id: "", jour: 0, heure_debut: "08:00", heure_fin: "10:00", matiere: "" };

export default function PlanningPage() {
  const [segs,      setSegs]      = useState<Seg[]>([]);
  const [sessId,    setSessId]    = useState("");
  const [sessName,  setSessName]  = useState("");
  const [modal,     setModal]     = useState<null | "create" | Seg>(null);
  const [form,      setForm]      = useState<typeof EMPTY>(EMPTY);
  const [loading,   setLoading]   = useState(false);
  const [delTarget, setDelTarget] = useState<Seg | null>(null);
  const [page,      setPage]      = useState(0);

  // ── Chargement session active ───────────────────────────────────────────────
  useEffect(() => {
    sessionsApi.list().then(r => {
      const active = (r.data.items ?? []).find((s: any) => s.status === "active");
      if (active) { setSessId(active.id); setSessName(active.name); }
    }).catch(() => {});
  }, []);

  const loadSegs = () =>
    planningApi.list(sessId || undefined)
      .then(r => { setSegs(r.data.items ?? []); setPage(0); })
      .catch(() => {});

  useEffect(() => { if (sessId) loadSegs(); }, [sessId]);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const save = async () => {
    setLoading(true);
    try {
      if (modal === "create") await planningApi.create(form);
      else await planningApi.update((modal as Seg).id, form);
      loadSegs();
      setModal(null);
    } finally { setLoading(false); }
  };

  const confirmDelete = async () => {
    if (!delTarget) return;
    setLoading(true);
    try { await planningApi.delete(delTarget.id); loadSegs(); setDelTarget(null); }
    finally { setLoading(false); }
  };

  // ── Données groupées & paginées ─────────────────────────────────────────────
  const segsByDay = segs.reduce<Record<number, Seg[]>>((acc, s) => {
    (acc[s.jour] ??= []).push(s);
    return acc;
  }, {});

  const activeDays  = Object.keys(segsByDay).map(Number).sort((a, b) => a - b);
  const totalPages  = Math.max(1, Math.ceil(activeDays.length / DAYS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleDays = activeDays.slice(currentPage * DAYS_PER_PAGE, (currentPage + 1) * DAYS_PER_PAGE);

  return (
    <div className="flex flex-col min-h-full px-7 pb-7">

      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Gestion Planning</h1>
          <p className="text-tx-muted text-sm mt-0.5">
            {segs.length} créneau{segs.length !== 1 ? "x" : ""} · {activeDays.length} jour{activeDays.length !== 1 ? "s" : ""}
            {sessName && <span className="ml-2 text-brand font-medium">· {sessName}</span>}
          </p>
        </div>
        <button
          onClick={() => { setForm({ ...EMPTY, session_id: sessId }); setModal("create"); }}
          className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Ajouter créneau
        </button>
      </div>

      {/* ── Alerte session inactive ─────────────────────────────────────────── */}
      {!sessId && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-warn-soft text-warn text-sm font-medium">
          Aucune session active. Activez une session pour gérer le planning.
        </div>
      )}

      {/* ── Emploi du temps groupé par jour ────────────────────────────────── */}
      {segs.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border flex-1 flex flex-col items-center justify-center gap-3 py-20">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-tx-muted/40">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p className="text-tx-muted text-sm">Aucun créneau pour l'instant</p>
          {sessId && (
            <button
              onClick={() => { setForm({ ...EMPTY, session_id: sessId }); setModal("create"); }}
              className="mt-1 text-xs text-brand hover:underline font-medium">
              + Ajouter le premier créneau
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Blocs jours */}
          <div className="space-y-6">
            {visibleDays.map(jour => {
              const rows = (segsByDay[jour] ?? []).slice().sort((a, b) =>
                a.heure_debut.localeCompare(b.heure_debut)
              );
              return (
                <div key={jour} className="bg-surface rounded-2xl border border-border overflow-hidden">

                  {/* En-tête du jour */}
                  <div className="flex items-center justify-between px-5 py-3 bg-surface-alt border-b border-border">
                    <h2 className="text-sm font-bold text-brand uppercase tracking-widest">
                      {JOURS[jour]}
                    </h2>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-tx-muted">
                        {rows.length} créneau{rows.length !== 1 ? "x" : ""}
                      </span>
                      <button
                        onClick={() => { setForm({ ...EMPTY, session_id: sessId, jour }); setModal("create"); }}
                        className="flex items-center gap-1 text-xs text-brand hover:text-brand-dark font-semibold transition-colors">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M12 5v14M5 12h14"/>
                        </svg>
                        Ajouter
                      </button>
                    </div>
                  </div>

                  {/* Tableau Heure | Activité | Actions */}
                  <table className="w-full text-sm">
                    <colgroup>
                      <col className="w-[22%]"/>
                      <col/>
                      <col className="w-[160px]"/>
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-tx-muted uppercase tracking-wide">
                          Heure
                        </th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-tx-muted uppercase tracking-wide">
                          Activité
                        </th>
                        <th className="px-5 py-2.5 text-center text-xs font-semibold text-tx-muted uppercase tracking-wide">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s, i) => (
                        <tr
                          key={s.id}
                          className={`border-t border-border hover:bg-surface-alt transition-colors ${
                            i % 2 !== 0 ? "bg-surface-alt/40" : ""
                          }`}>
                          <td className="px-5 py-3 font-mono text-xs text-tx-muted whitespace-nowrap">
                            {s.heure_debut} – {s.heure_fin}
                          </td>
                          <td className="px-5 py-3 text-tx font-medium">
                            {s.matiere ?? (
                              <span className="text-tx-muted italic">Sans titre</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => {
                                  setForm({
                                    session_id: s.session_id,
                                    jour: s.jour,
                                    heure_debut: s.heure_debut,
                                    heure_fin: s.heure_fin,
                                    matiere: s.matiere ?? "",
                                  });
                                  setModal(s);
                                }}
                                className="text-xs bg-primary-soft text-primary px-2.5 py-1 rounded-lg font-medium hover:bg-primary hover:text-white transition-colors">
                                Modifier
                              </button>
                              <button
                                onClick={() => setDelTarget(s)}
                                className="text-xs bg-danger-soft text-danger px-2.5 py-1 rounded-lg font-medium hover:bg-danger hover:text-white transition-colors">
                                Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* ── Pagination ────────────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 px-1">
              {/* Info */}
              <p className="text-xs text-tx-muted">
                Jours{" "}
                <span className="font-semibold text-tx">
                  {currentPage * DAYS_PER_PAGE + 1}–{Math.min((currentPage + 1) * DAYS_PER_PAGE, activeDays.length)}
                </span>
                {" "}sur{" "}
                <span className="font-semibold text-tx">{activeDays.length}</span>
              </p>

              {/* Contrôles */}
              <div className="flex items-center gap-1">
                {/* Précédent */}
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-tx-muted hover:bg-surface-alt hover:text-tx disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6"/>
                  </svg>
                </button>

                {/* Numéros de page */}
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      i === currentPage
                        ? "bg-brand text-white"
                        : "border border-border text-tx-muted hover:bg-surface-alt hover:text-tx"
                    }`}>
                    {i + 1}
                  </button>
                ))}

                {/* Suivant */}
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage === totalPages - 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-tx-muted hover:bg-surface-alt hover:text-tx disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modal Créer / Modifier ───────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-base font-bold text-tx mb-5">
              {modal === "create" ? "Nouveau créneau" : "Modifier le créneau"}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-tx mb-1">Jour</label>
                <select
                  value={form.jour}
                  onChange={e => setForm(f => ({ ...f, jour: +e.target.value }))}
                  className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition">
                  {JOURS.map((j, i) => <option key={i} value={i}>{j}</option>)}
                </select>
              </div>
              {(
                [
                  ["Heure de début", "heure_debut"],
                  ["Heure de fin",   "heure_fin"],
                  ["Activité",       "matiere"],
                ] as [string, string][]
              ).map(([label, key]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-tx mb-1">{label}</label>
                  <input
                    type={key.startsWith("heure") ? "time" : "text"}
                    value={(form as any)[key] ?? ""}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">
                Annuler
              </button>
              <button
                onClick={save}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {loading ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmation Suppression ──────────────────────────────────── */}
      {delTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-danger-soft flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-tx">Supprimer le créneau</h2>
                <p className="text-sm text-tx-muted mt-1">
                  Supprimer le créneau du{" "}
                  <span className="font-semibold text-tx">{JOURS[delTarget.jour]}</span> de{" "}
                  <span className="font-semibold text-tx">{delTarget.heure_debut} à {delTarget.heure_fin}</span> ?{" "}
                  Cette action est irréversible.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDelTarget(null)}
                className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-danger hover:bg-danger/90 text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {loading ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
