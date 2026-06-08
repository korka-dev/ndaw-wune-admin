"use client";
import { useEffect, useState, useCallback } from "react";
import { rapportJournalierAdminApi } from "@/lib/api";
import { downloadBlob } from "@/lib/csv";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

// ── Types ──────────────────────────────────────────────────────────────────────
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
  difficultes: string | string[];
  autres_difficultes: string | null;
  description_difficultes: string | null;
  directeur_venu: boolean;
  besoin_appui: boolean;
  domaines_appui: string | null;
  has_observations: boolean;
  commentaires: string | null;
  soumis_en_offline: boolean;
  photo_classe_url: string | null;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return d; }
}

function parseDifficultes(d: string | string[]): string[] {
  if (Array.isArray(d)) return d;
  if (!d) return [];
  try { const parsed = JSON.parse(d); return Array.isArray(parsed) ? parsed : [d]; }
  catch { return [d]; }
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function RapportsJournaliersPage() {
  const [rapports, setRapports] = useState<RapportJournalier[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);

  // Filtres
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | "enseignant" | "superviseur">("");

  // Modal détail
  const [detail, setDetail] = useState<RapportJournalier | null>(null);

  const fetchRapports = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        skip: (p - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      };
      if (search.trim()) params.search = search.trim();
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (roleFilter) params.role = roleFilter;

      const res = await rapportJournalierAdminApi.list(params);
      setRapports(res.data.items ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      setRapports([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, dateFrom, dateTo, roleFilter]);

  // Re-fetch when filters or page changes
  useEffect(() => { fetchRapports(page); }, [fetchRapports, page]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo, roleFilter]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, unknown> = {};
      if (search.trim()) params.search = search.trim();
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (roleFilter) params.role = roleFilter;
      const res = await rapportJournalierAdminApi.exportCsv(params);
      downloadBlob(res.data, "rapports-journaliers.csv");
    } catch { /* silencieux */ }
    finally { setExporting(false); }
  };

  return (
    <div className="flex flex-col min-h-full px-7 pb-7">

      {/* ── En-tête sticky ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Rapports Journaliers</h1>
          <p className="text-tx-muted text-sm mt-0.5">
            {loading ? "Chargement…" : `${total} rapport${total !== 1 ? "s" : ""} au total`}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 bg-surface border border-border hover:bg-surface-alt text-tx px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {exporting ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
          {exporting ? "Export…" : "Exporter CSV"}
        </button>
      </div>

      {/* ── Filtres ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* Filtre par rôle de l'auteur (enseignant / superviseur) */}
        <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
          {([
            { key: "", label: "Tous" },
            { key: "enseignant", label: "Enseignants" },
            { key: "superviseur", label: "Superviseurs" },
          ] as const).map(opt => (
            <button
              key={opt.key || "all"}
              onClick={() => setRoleFilter(opt.key)}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                roleFilter === opt.key
                  ? "bg-brand text-white"
                  : "text-tx-muted hover:bg-surface-alt hover:text-tx"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Recherche texte */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tuteur, école, IEF, commune…"
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-9 py-2.5 text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tx-muted hover:text-tx">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Date from */}
        <input
          type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
        />

        {/* Date to */}
        <input
          type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
        />

        {/* Clear filters */}
        {(search || dateFrom || dateTo || roleFilter) && (
          <button
            onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setRoleFilter(""); }}
            className="px-4 py-2.5 rounded-xl text-sm text-tx-muted border border-border hover:bg-surface-alt transition-colors"
          >
            Effacer filtres
          </button>
        )}
      </div>

      {/* ── Tableau rapports ─────────────────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden flex-1">
        <table className="w-full text-sm table-fixed">
          <colgroup><col className="w-[12%]" /><col className="w-[18%]" /><col className="w-[22%]" /><col className="w-[14%]" /><col className="w-[12%]" /><col className="w-[16%]" /><col className="w-[6%]" /></colgroup>
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              {["Date", "Tuteur", "École / IEF", "Commune", "S · J", "Difficultés", ""].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-tx-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-16 text-center text-tx-muted text-sm">Chargement…</td></tr>
            ) : rapports.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-16 text-center text-tx-muted text-sm">
                {(search || dateFrom || dateTo || roleFilter) ? "Aucun rapport ne correspond aux filtres." : "Aucun rapport journalier pour l'instant."}
              </td></tr>
            ) : rapports.map(r => {
              const diffs = parseDifficultes(r.difficultes);
              return (
                <tr
                  key={r.id}
                  onClick={() => setDetail(r)}
                  className="border-t border-border hover:bg-surface-alt transition-colors cursor-pointer"
                >
                  {/* Date */}
                  <td className="px-4 py-3.5">
                    <span className="text-tx font-medium text-xs">{fmtDate(r.date_rapport)}</span>
                  </td>
                  {/* Tuteur */}
                  <td className="px-4 py-3.5">
                    <span className="text-tx font-medium truncate block">{r.nom_tuteur}</span>
                    {r.superviseur && <span className="text-tx-muted text-xs truncate block">{r.superviseur}</span>}
                  </td>
                  {/* École / IEF */}
                  <td className="px-4 py-3.5">
                    <span className="text-tx truncate block">{r.ecole}</span>
                    <span className="text-tx-muted text-xs truncate block">{r.ief}</span>
                  </td>
                  {/* Commune */}
                  <td className="px-4 py-3.5 text-tx-muted text-xs truncate">{r.commune}</td>
                  {/* Semaine · Jour */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full bg-brand-soft text-brand text-[11px] font-semibold">S{r.semaine}</span>
                      <span className="px-2 py-0.5 rounded-full bg-surface-alt border border-border text-tx-muted text-[11px] font-medium">J{r.jour_cours}</span>
                    </div>
                    {r.nb_absences > 0 && (
                      <span className="text-[11px] text-danger font-medium mt-1 block">
                        {r.nb_absences} abs.
                      </span>
                    )}
                  </td>
                  {/* Difficultés */}
                  <td className="px-4 py-3.5">
                    {diffs.length === 0 ? (
                      <span className="text-tx-muted text-xs">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {diffs.slice(0, 2).map((d, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-warn-soft text-warn text-[10px] font-medium truncate max-w-[90px]">{d}</span>
                        ))}
                        {diffs.length > 2 && (
                          <span className="px-2 py-0.5 rounded-full bg-surface-alt text-tx-muted text-[10px] font-medium">+{diffs.length - 2}</span>
                        )}
                      </div>
                    )}
                  </td>
                  {/* Chevron */}
                  <td className="px-4 py-3.5 text-right">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      className="text-tx-muted inline-block">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && total > 0 && (
          <div className="border-t border-border px-5">
            <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
          </div>
        )}
      </div>

      {/* ── Modal détail rapport ────────────────────────────────────────────── */}
      {detail && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
          onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}
        >
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            {/* En-tête */}
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold text-tx">{fmtDate(detail.date_rapport)}</span>
                  {detail.soumis_en_offline && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-warn-soft text-warn">Hors-ligne</span>
                  )}
                </div>
                <p className="text-sm text-tx-muted mt-0.5">{detail.nom_tuteur}</p>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-alt text-tx-muted transition-colors flex-shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* Photo */}
              {detail.photo_classe_url && (
                <Section title="Photo de la classe">
                  <img
                    src={detail.photo_classe_url}
                    alt="Photo de la classe"
                    className="w-full rounded-xl object-cover max-h-64"
                  />
                </Section>
              )}

              {/* Informations générales */}
              <Section title="Informations générales">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "École", value: detail.ecole },
                    { label: "IEF", value: detail.ief },
                    { label: "Commune", value: detail.commune },
                    { label: "Superviseur", value: detail.superviseur },
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
                  <div className="bg-brand-soft text-brand rounded-xl px-4 py-3 text-sm font-semibold">Semaine {detail.semaine}</div>
                  <div className="text-tx-muted">·</div>
                  <div className="bg-surface-alt text-tx rounded-xl px-4 py-3 text-sm font-medium">Jour {detail.jour_cours}</div>
                </div>
              </Section>

              {/* Absences */}
              <Section title={`Absences (${detail.nb_absences})`}>
                {detail.nb_absences === 0 ? (
                  <p className="text-sm text-tx-muted">Aucune absence signalée.</p>
                ) : (
                  <div className="space-y-2">
                    <span className="px-2.5 py-1 rounded-full bg-danger-soft text-danger text-xs font-bold">
                      {detail.nb_absences} absent{detail.nb_absences !== 1 ? "s" : ""}
                    </span>
                    {detail.absents && (
                      <p className="text-sm text-tx bg-surface-alt rounded-xl px-4 py-3 mt-2">{detail.absents}</p>
                    )}
                  </div>
                )}
              </Section>

              {/* Difficultés */}
              <Section title="Difficultés">
                {(() => {
                  const diffs = parseDifficultes(detail.difficultes);
                  return diffs.length === 0 ? (
                    <p className="text-sm text-tx-muted">Aucune difficulté signalée.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {diffs.map((d, i) => (
                          <span key={i} className="px-2.5 py-1 rounded-full bg-warn-soft text-warn text-xs font-medium">{d}</span>
                        ))}
                        {detail.autres_difficultes && (
                          <span className="px-2.5 py-1 rounded-full bg-surface-alt text-tx-muted text-xs font-medium">{detail.autres_difficultes}</span>
                        )}
                      </div>
                      {detail.description_difficultes && (
                        <p className="text-sm text-tx bg-surface-alt rounded-xl px-4 py-3">{detail.description_difficultes}</p>
                      )}
                    </div>
                  );
                })()}
              </Section>

              {/* Supervision */}
              <Section title="Supervision">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-alt rounded-xl px-4 py-3">
                    <div className="text-[11px] text-tx-muted mb-1">Directeur venu</div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${detail.directeur_venu ? "bg-success-soft text-success" : "bg-surface border border-border text-tx-muted"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${detail.directeur_venu ? "bg-success" : "bg-tx-muted/40"}`} />
                      {detail.directeur_venu ? "Oui" : "Non"}
                    </span>
                  </div>
                  <div className="bg-surface-alt rounded-xl px-4 py-3">
                    <div className="text-[11px] text-tx-muted mb-1">Besoin d&apos;appui</div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${detail.besoin_appui ? "bg-warn-soft text-warn" : "bg-surface border border-border text-tx-muted"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${detail.besoin_appui ? "bg-warn" : "bg-tx-muted/40"}`} />
                      {detail.besoin_appui ? "Oui" : "Non"}
                    </span>
                  </div>
                </div>
                {detail.besoin_appui && detail.domaines_appui && (
                  <div className="bg-surface-alt rounded-xl px-4 py-3 mt-3">
                    <div className="text-[11px] text-tx-muted mb-0.5">Domaines d&apos;appui</div>
                    <p className="text-sm text-tx">{detail.domaines_appui}</p>
                  </div>
                )}
              </Section>

              {/* Observations */}
              {detail.has_observations && detail.commentaires && (
                <Section title="Observations">
                  <p className="text-sm text-tx bg-surface-alt rounded-xl px-4 py-3">{detail.commentaires}</p>
                </Section>
              )}

            </div>

            <div className="px-6 pb-5 border-t border-border pt-4 flex justify-end">
              <button
                onClick={() => setDetail(null)}
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
