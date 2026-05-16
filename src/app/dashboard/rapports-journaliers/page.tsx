"use client";
import { useEffect, useState } from "react";
import { teachersApi, rapportJournalierAdminApi } from "@/lib/api";
import { downloadBlob } from "@/lib/csv";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

// ── Types ──────────────────────────────────────────────────────────────────────
interface Teacher {
  id: string;
  name: string;
  title?: string;
  phone?: string;
  school_id?: string;
}

interface RapportJournalier {
  id: string;
  teacher_id: string;
  nom_tuteur: string;
  date_rapport: string;
  ief: string;
  commune: string;
  ecole: string;
  superviseur: string;
  nb_absences: number;
  absents: string | null;
  semaine: number;
  jour_cours: number;
  difficultes: string[];
  autres_difficultes: string | null;
  description_difficultes: string | null;
  directeur_venu: boolean;
  besoin_appui: boolean;
  domaines_appui: string | null;
  has_observations: boolean;
  commentaires: string | null;
  soumis_en_offline: boolean;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return d; }
}
function initials(n: string) {
  return n.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function RapportsJournaliersPage() {
  const [teachers,       setTeachers]       = useState<Teacher[]>([]);
  const [search,         setSearch]         = useState("");
  const [loading,        setLoading]        = useState(true);
  const [exporting,      setExporting]      = useState(false);
  const [page,           setPage]           = useState(1);

  // Modal rapports d'un tuteur
  const [modalTeacher,   setModalTeacher]   = useState<Teacher | null>(null);
  const [rapports,       setRapports]       = useState<RapportJournalier[]>([]);
  const [loadingRapports,setLoadingRapports]= useState(false);

  // Modal détail d'un rapport
  const [detailRapport,  setDetailRapport]  = useState<RapportJournalier | null>(null);

  useEffect(() => {
    teachersApi.list()
      .then(r => setTeachers(r.data.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openTeacherModal = (t: Teacher) => {
    setModalTeacher(t);
    setRapports([]);
    setLoadingRapports(true);
    rapportJournalierAdminApi.list({ teacher_id: t.id, limit: 100 })
      .then(r => setRapports(r.data.items ?? r.data ?? []))
      .catch(() => setRapports([]))
      .finally(() => setLoadingRapports(false));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await rapportJournalierAdminApi.exportCsv();
      downloadBlob(res.data, "rapports-journaliers.csv");
    } catch { /* silencieux */ }
    finally { setExporting(false); }
  };

  /* Réinitialiser la page quand la recherche change */
  useEffect(() => { setPage(1); }, [search]);

  const filtered = teachers.filter(t =>
    !search.trim() || t.name.toLowerCase().includes(search.toLowerCase())
  );
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col min-h-full px-7 pb-7">

      {/* ── En-tête sticky ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Rapports Journaliers</h1>
          <p className="text-tx-muted text-sm mt-0.5">
            {loading
              ? "Chargement…"
              : `${filtered.length} tuteur${filtered.length !== 1 ? "s" : ""} ${search ? `sur ${teachers.length}` : "au total"}`}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 bg-surface border border-border hover:bg-surface-alt text-tx px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {exporting ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          )}
          {exporting ? "Export…" : "Exporter CSV"}
        </button>
      </div>

      {/* ── Barre recherche ─────────────────────────────────────────────────── */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un tuteur…"
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tx-muted hover:text-tx">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Tableau tuteurs ─────────────────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden flex-1">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[35%]"/>
            <col className="w-[25%]"/>
            <col className="w-[25%]"/>
            <col className="w-[15%]"/>
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              {["Tuteur", "Contact", "Titre", "Rapports"].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-tx-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-5 py-16 text-center text-tx-muted text-sm">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-16 text-center text-tx-muted text-sm">
                {search ? "Aucun tuteur ne correspond à la recherche." : "Aucun tuteur enregistré."}
              </td></tr>
            ) : paginated.map(t => (
              <tr
                key={t.id}
                onClick={() => openTeacherModal(t)}
                className="border-t border-border hover:bg-surface-alt transition-colors cursor-pointer"
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-brand-soft text-brand flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {initials(t.name)}
                    </div>
                    <span className="font-medium text-tx">{t.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-tx-muted">{t.phone ?? "—"}</td>
                <td className="px-5 py-3.5 text-tx-muted">{t.title ?? "—"}</td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand bg-brand-soft px-2.5 py-1 rounded-full">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z"/>
                      <path d="M14 3v6h6"/>
                    </svg>
                    Voir rapports
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 pb-4">
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      {/* ── Modal : liste des rapports d'un tuteur ──────────────────────────── */}
      {modalTeacher && !detailRapport && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
          onClick={e => { if (e.target === e.currentTarget) setModalTeacher(null); }}
        >
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

            {/* En-tête modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-soft text-brand flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {initials(modalTeacher.name)}
                </div>
                <div>
                  <div className="font-bold text-tx text-base">{modalTeacher.name}</div>
                  <div className="text-xs text-tx-muted">
                    {loadingRapports ? "Chargement…" : `${rapports.length} rapport${rapports.length !== 1 ? "s" : ""} envoyé${rapports.length !== 1 ? "s" : ""}`}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setModalTeacher(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-alt text-tx-muted transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Corps : liste rapports */}
            <div className="overflow-y-auto flex-1 px-5 py-4">
              {loadingRapports ? (
                <div className="flex items-center justify-center py-16 text-tx-muted text-sm">Chargement…</div>
              ) : rapports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-tx-muted/40">
                    <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z"/>
                    <path d="M14 3v6h6"/>
                  </svg>
                  <p className="text-tx-muted text-sm">Aucun rapport journalier envoyé pour l'instant.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rapports.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setDetailRapport(r)}
                      className="w-full text-left bg-surface-alt hover:bg-brand-soft/40 border border-border hover:border-brand/20 rounded-xl px-4 py-3.5 transition-all group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-tx capitalize">{fmtDate(r.date_rapport)}</span>
                            <span className="text-tx-muted text-xs">·</span>
                            <span className="text-xs text-tx-muted">Sem. {r.semaine} · Jour {r.jour_cours}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-tx-muted">
                            <span>{r.ecole}</span>
                            {r.ief && <><span>·</span><span>{r.ief}</span></>}
                            <span>· {r.nb_absences} absence{r.nb_absences !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {r.soumis_en_offline ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-warn-soft text-warn">Hors-ligne</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-success-soft text-success">En ligne</span>
                          )}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                            className="text-tx-muted group-hover:text-brand transition-colors">
                            <path d="M9 18l6-6-6-6"/>
                          </svg>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex-shrink-0">
              <button
                onClick={() => setModalTeacher(null)}
                className="w-full py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal : détail d'un rapport ─────────────────────────────────────── */}
      {detailRapport && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
          onClick={e => { if (e.target === e.currentTarget) setDetailRapport(null); }}
        >
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            {/* En-tête */}
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setDetailRapport(null)}
                    className="flex items-center gap-1 text-tx-muted hover:text-brand text-xs font-medium transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
                    Retour
                  </button>
                  <span className="text-tx-muted text-xs">·</span>
                  <span className="text-sm font-bold text-tx capitalize">{fmtDate(detailRapport.date_rapport)}</span>
                  {detailRapport.soumis_en_offline && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-warn-soft text-warn">Hors-ligne</span>
                  )}
                </div>
                <p className="text-xs text-tx-muted mt-1">{detailRapport.nom_tuteur}</p>
              </div>
              <button
                onClick={() => { setDetailRapport(null); setModalTeacher(null); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-alt text-tx-muted transition-colors flex-shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* Infos générales */}
              <Section title="Informations générales">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "École",       value: detailRapport.ecole       },
                    { label: "IEF",         value: detailRapport.ief         },
                    { label: "Commune",     value: detailRapport.commune     },
                    { label: "Superviseur", value: detailRapport.superviseur },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-surface-alt rounded-xl px-4 py-3">
                      <div className="text-[11px] text-tx-muted mb-0.5">{label}</div>
                      <div className="text-sm font-medium text-tx">{value || "—"}</div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Progression */}
              <Section title="Progression">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-soft text-brand rounded-xl px-4 py-3 text-sm font-semibold">Semaine {detailRapport.semaine}</div>
                  <div className="text-tx-muted">·</div>
                  <div className="bg-surface-alt text-tx rounded-xl px-4 py-3 text-sm font-medium">Jour {detailRapport.jour_cours}</div>
                </div>
              </Section>

              {/* Absences */}
              <Section title={`Absences (${detailRapport.nb_absences})`}>
                {detailRapport.nb_absences === 0 ? (
                  <p className="text-sm text-tx-muted">Aucune absence signalée.</p>
                ) : (
                  <div className="space-y-2">
                    <span className="px-2.5 py-1 rounded-full bg-danger-soft text-danger text-xs font-bold">
                      {detailRapport.nb_absences} absent{detailRapport.nb_absences !== 1 ? "s" : ""}
                    </span>
                    {detailRapport.absents && (
                      <p className="text-sm text-tx bg-surface-alt rounded-xl px-4 py-3 mt-2">{detailRapport.absents}</p>
                    )}
                  </div>
                )}
              </Section>

              {/* Difficultés */}
              <Section title="Difficultés">
                {detailRapport.difficultes.length === 0 ? (
                  <p className="text-sm text-tx-muted">Aucune difficulté signalée.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {detailRapport.difficultes.map((d, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-full bg-warn-soft text-warn text-xs font-medium">{d}</span>
                      ))}
                      {detailRapport.autres_difficultes && (
                        <span className="px-2.5 py-1 rounded-full bg-surface-alt text-tx-muted text-xs font-medium">{detailRapport.autres_difficultes}</span>
                      )}
                    </div>
                    {detailRapport.description_difficultes && (
                      <p className="text-sm text-tx bg-surface-alt rounded-xl px-4 py-3">{detailRapport.description_difficultes}</p>
                    )}
                  </div>
                )}
              </Section>

              {/* Supervision */}
              <Section title="Supervision">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-alt rounded-xl px-4 py-3">
                    <div className="text-[11px] text-tx-muted mb-1">Directeur venu</div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${detailRapport.directeur_venu ? "bg-success-soft text-success" : "bg-surface border border-border text-tx-muted"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${detailRapport.directeur_venu ? "bg-success" : "bg-tx-muted/40"}`}/>
                      {detailRapport.directeur_venu ? "Oui" : "Non"}
                    </span>
                  </div>
                  <div className="bg-surface-alt rounded-xl px-4 py-3">
                    <div className="text-[11px] text-tx-muted mb-1">Besoin d'appui</div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${detailRapport.besoin_appui ? "bg-warn-soft text-warn" : "bg-surface border border-border text-tx-muted"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${detailRapport.besoin_appui ? "bg-warn" : "bg-tx-muted/40"}`}/>
                      {detailRapport.besoin_appui ? "Oui" : "Non"}
                    </span>
                  </div>
                </div>
                {detailRapport.besoin_appui && detailRapport.domaines_appui && (
                  <div className="bg-surface-alt rounded-xl px-4 py-3 mt-3">
                    <div className="text-[11px] text-tx-muted mb-0.5">Domaines d'appui</div>
                    <p className="text-sm text-tx">{detailRapport.domaines_appui}</p>
                  </div>
                )}
              </Section>

              {/* Observations */}
              {detailRapport.has_observations && detailRapport.commentaires && (
                <Section title="Observations">
                  <p className="text-sm text-tx bg-surface-alt rounded-xl px-4 py-3">{detailRapport.commentaires}</p>
                </Section>
              )}

            </div>

            <div className="px-6 pb-5 border-t border-border pt-4 flex justify-end">
              <button
                onClick={() => { setDetailRapport(null); setModalTeacher(null); }}
                className="px-5 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section helper ─────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-tx-muted uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </div>
  );
}
