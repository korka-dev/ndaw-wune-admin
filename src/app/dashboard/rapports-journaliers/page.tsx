"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { rapportJournalierAdminApi, rapportQuestionsApi, rapportDifficulteResolutionsApi } from "@/lib/api";
import { downloadBlob } from "@/lib/csv";
import Pagination from "@/components/Pagination";
import ExportModal from "@/components/ExportModal";
import RapportPhoto from "@/components/RapportPhoto";
import { LineChart, BarList, Donut, Carte, type Point } from "@/components/Charts";

const PAGE_SIZE = 20;

const RAPPORT_EXPORT_FIELDS = [
  { key: "date_rapport",            label: "Date du rapport" },
  { key: "tuteur",                  label: "Tuteur" },
  { key: "ief",                     label: "IEF" },
  { key: "commune",                 label: "Commune" },
  { key: "ecole",                   label: "École" },
  { key: "superviseur",             label: "Superviseur" },
  { key: "nb_absences",             label: "Nombre d'absences" },
  { key: "absents",                 label: "Élèves absents" },
  { key: "semaine",                 label: "Semaine" },
  { key: "jour_cours",              label: "Jour de cours" },
  { key: "difficultes",             label: "Difficultés" },
  { key: "autres_difficultes",      label: "Autres difficultés" },
  { key: "description_difficultes", label: "Description des difficultés" },
  { key: "directeur_venu",          label: "Directeur venu" },
  { key: "besoin_appui",            label: "Besoin d'appui" },
  { key: "domaines_appui",          label: "Domaines d'appui" },
  { key: "has_observations",        label: "Observations présentes" },
  { key: "commentaires",            label: "Commentaires" },
  { key: "soumis_en_offline",       label: "Soumis hors-ligne" },
];

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
  reponses_questions: string | null;
  // Les photos ne transitent plus dans la liste (1 à 3 Mo par rapport en
  // base64) : seul leur nombre est renvoyé, les images se chargent une par une.
  nb_photos: number;
  created_at: string;
}

interface RapportStats {
  total: number;
  tuteurs_actifs: number;
  absences_total: number;
  absences_moyenne: number;
  taux_directeur_venu: number;
  taux_besoin_appui: number;
  taux_observations: number;
  taux_offline: number;
  rapports_avec_photos: number;
  photos_total: number;
  par_mois: Point[];
  par_ief: Point[];
  top_ecoles: Point[];
  difficultes: Point[];
  par_jour: Point[];
}

interface PhotoItem {
  id: string;
  date_rapport: string;
  nom_tuteur: string;
  ecole: string;
  ief: string;
  commune: string;
  nb_photos: number;
}

type Onglet = "liste" | "stats" | "photos";
const PHOTOS_PAGE_SIZE = 12;

interface RapportQuestionDef {
  id: string;
  label: string;
  type: string;
  options: string[] | null;
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
  const [showExportModal, setShowExportModal] = useState(false);
  const [page, setPage] = useState(1);

  // Onglets
  const [onglet, setOnglet] = useState<Onglet>("liste");

  // Statistiques
  const [stats, setStats] = useState<RapportStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Galerie photos
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photosTotal, setPhotosTotal] = useState(0);
  const [photosPage, setPhotosPage] = useState(1);
  const [photosLoading, setPhotosLoading] = useState(false);

  // Visionneuse plein écran
  const [visionneuse, setVisionneuse] = useState<{
    rapportId: string; index: number; nb: number; titre: string; sous: string;
  } | null>(null);

  // Filtres
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | "enseignant" | "superviseur">("");

  // Debounce recherche — évite une requête par frappe clavier
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (v: string) => {
    setSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(v), 350);
  };

  // Modal détail
  const [detail, setDetail] = useState<RapportJournalier | null>(null);
  const [questionDefs, setQuestionDefs] = useState<RapportQuestionDef[]>([]);

  // Résolution des difficultés du rapport ouvert
  const [resolutions, setResolutions] = useState<Record<string, boolean>>({});
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    rapportQuestionsApi.list().then(({ data }) => setQuestionDefs(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!detail) { setResolutions({}); return; }
    rapportDifficulteResolutionsApi.list({ rapport_id: detail.id })
      .then(({ data }) => {
        const map: Record<string, boolean> = {};
        (data ?? []).forEach((row: { difficulte_label: string; resolue: boolean }) => {
          map[row.difficulte_label] = row.resolue;
        });
        setResolutions(map);
      })
      .catch(() => setResolutions({}));
  }, [detail]);

  const toggleResolve = async (label: string) => {
    if (!detail) return;
    const nextValue = !resolutions[label];
    setResolving(label);
    try {
      await rapportDifficulteResolutionsApi.resolve(detail.id, { difficulte_label: label, resolue: nextValue });
      setResolutions(prev => ({ ...prev, [label]: nextValue }));
    } catch { /* silencieux */ }
    finally { setResolving(null); }
  };

  const fetchRapports = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        skip: (p - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
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
  }, [debouncedSearch, dateFrom, dateTo, roleFilter]);

  const filtres = useCallback(() => {
    const p: Record<string, unknown> = {};
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim();
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    if (roleFilter) p.role = roleFilter;
    return p;
  }, [debouncedSearch, dateFrom, dateTo, roleFilter]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await rapportJournalierAdminApi.stats(filtres());
      setStats(res.data);
    } catch { setStats(null); }
    finally { setStatsLoading(false); }
  }, [filtres]);

  const fetchPhotos = useCallback(async (p: number) => {
    setPhotosLoading(true);
    try {
      const res = await rapportJournalierAdminApi.photos({
        ...filtres(), skip: (p - 1) * PHOTOS_PAGE_SIZE, limit: PHOTOS_PAGE_SIZE,
      });
      setPhotos(res.data.items ?? []);
      setPhotosTotal(res.data.total ?? 0);
    } catch { setPhotos([]); setPhotosTotal(0); }
    finally { setPhotosLoading(false); }
  }, [filtres]);

  // Re-fetch when filters or page changes
  useEffect(() => { if (onglet === "liste") fetchRapports(page); }, [onglet, fetchRapports, page]);
  useEffect(() => { if (onglet === "stats") fetchStats(); }, [onglet, fetchStats]);
  useEffect(() => { if (onglet === "photos") fetchPhotos(photosPage); }, [onglet, fetchPhotos, photosPage]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); setPhotosPage(1); }, [debouncedSearch, dateFrom, dateTo, roleFilter]);

  const handleExport = async (fields: string[]) => {
    setExporting(true);
    try {
      const params: Record<string, unknown> = { fields: fields.join(",") };
      if (search.trim()) params.search = search.trim();
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (roleFilter) params.role = roleFilter;
      const res = await rapportJournalierAdminApi.exportCsv(params);
      downloadBlob(res.data, "rapports-journaliers.csv");
      setShowExportModal(false);
    } catch { /* silencieux */ }
    finally { setExporting(false); }
  };

  return (
    <div className="flex flex-col min-h-full flex-shrink-0 px-7 pb-7">

      {/* ── En-tête sticky ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Rapports Journaliers</h1>
          <p className="text-tx-muted text-sm mt-0.5">
            {loading ? "Chargement…" : `${total} rapport${total !== 1 ? "s" : ""} au total`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Onglets */}
          <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
            {([
              { key: "liste",  label: "Liste" },
              { key: "stats",  label: "Statistiques" },
              { key: "photos", label: "Photos" },
            ] as const).map(o => (
              <button
                key={o.key}
                onClick={() => setOnglet(o.key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  onglet === o.key ? "bg-brand text-white" : "text-tx-muted hover:bg-surface-alt hover:text-tx"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowExportModal(true)}
            disabled={exporting}
            className="flex items-center gap-2 bg-surface border border-border hover:bg-surface-alt text-tx px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex-shrink-0"
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
      </div>

      {/* ── Filtres ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        {/* Recherche texte — occupe toute la largeur disponible, à gauche */}
        <div className="relative flex-1">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text" value={search} onChange={e => handleSearchChange(e.target.value)}
            placeholder="Tuteur, école, IEF, commune…"
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-9 py-2.5 text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
          />
          {search && (
            <button onClick={() => { setSearch(""); setDebouncedSearch(""); }} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tx-muted hover:text-tx">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Date from */}
        <input
          type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition flex-shrink-0"
        />

        {/* Date to */}
        <input
          type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition flex-shrink-0"
        />

        {/* Clear filters */}
        {(search || dateFrom || dateTo || roleFilter) && (
          <button
            onClick={() => { setSearch(""); setDebouncedSearch(""); setDateFrom(""); setDateTo(""); setRoleFilter(""); }}
            className="px-4 py-2.5 rounded-xl text-sm text-tx-muted border border-border hover:bg-surface-alt transition-colors flex-shrink-0"
          >
            Effacer filtres
          </button>
        )}

        {/* Filtre par rôle de l'auteur — à droite */}
        <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1 flex-shrink-0">
          {([
            { key: "", label: "Tous" },
            { key: "enseignant", label: "Enseignants" },
            { key: "superviseur", label: "Superviseurs" },
          ] as const).map(opt => (
            <button
              key={opt.key || "all"}
              onClick={() => setRoleFilter(opt.key)}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                roleFilter === opt.key
                  ? "bg-brand text-white"
                  : "text-tx-muted hover:bg-surface-alt hover:text-tx"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tableau rapports ─────────────────────────────────────────────────── */}
      {onglet === "liste" && (
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
      )}

      {/* ── Statistiques ─────────────────────────────────────────────────────── */}
      {onglet === "stats" && (
        statsLoading || !stats ? (
          <p className="text-tx-muted text-sm py-16 text-center">
            {statsLoading ? "Calcul des statistiques…" : "Statistiques indisponibles."}
          </p>
        ) : stats.total === 0 ? (
          <p className="text-tx-muted text-sm py-16 text-center">
            Aucun rapport ne correspond aux filtres.
          </p>
        ) : (
          <div className="flex flex-col gap-5">

            {/* Chiffres clés */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Rapports", value: stats.total },
                { label: "Tuteurs ayant saisi", value: stats.tuteurs_actifs },
                { label: "Absences cumulées", value: stats.absences_total },
                { label: "Absences par rapport", value: stats.absences_moyenne },
                { label: "Rapports avec photo", value: stats.rapports_avec_photos },
                { label: "Photos au total", value: stats.photos_total },
              ].map(c => (
                <div key={c.label} className="bg-surface border border-border rounded-2xl p-4 text-center">
                  <p className="text-2xl font-bold text-tx leading-none">{c.value}</p>
                  <p className="text-[11px] text-tx-muted mt-1.5 leading-tight">{c.label}</p>
                </div>
              ))}
            </div>

            {/* Courbe + taux */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2">
                <Carte titre="Rapports par mois" sous="Sur la période filtrée">
                  <LineChart data={stats.par_mois} />
                </Carte>
              </div>
              <Carte titre="Taux déclarés" sous="Part des rapports concernés">
                <div className="grid grid-cols-2 gap-3">
                  <Donut pct={stats.taux_directeur_venu} legende="Directeur venu" color="#2F7D4A" />
                  <Donut pct={stats.taux_besoin_appui} legende="Besoin d'appui" color="#C08A3E" />
                  <Donut pct={stats.taux_observations} legende="Observations" color="#4A90C2" />
                  <Donut pct={stats.taux_offline} legende="Saisis hors-ligne" color="#8A6BB8" />
                </div>
              </Carte>
            </div>

            {/* Répartitions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Carte titre="Difficultés les plus signalées" sous="10 premières">
                <BarList data={stats.difficultes} color="#C08A3E" />
              </Carte>
              <Carte titre="Rapports par IEF">
                <BarList data={stats.par_ief} color="#4A90C2" />
              </Carte>
              <Carte titre="Écoles les plus actives" sous="8 premières">
                <BarList data={stats.top_ecoles} color="#2F7D4A" />
              </Carte>
              <Carte titre="Rapports par jour de cours">
                <BarList data={stats.par_jour} color="#8A6BB8" />
              </Carte>
            </div>
          </div>
        )
      )}

      {/* ── Galerie photos ───────────────────────────────────────────────────── */}
      {onglet === "photos" && (
        <div className="flex flex-col gap-5">
          {photosLoading ? (
            <p className="text-tx-muted text-sm py-16 text-center">Chargement des photos…</p>
          ) : photos.length === 0 ? (
            <p className="text-tx-muted text-sm py-16 text-center">
              Aucun rapport avec photo ne correspond aux filtres.
            </p>
          ) : (
            <>
              <p className="text-xs text-tx-muted">
                {photosTotal} rapport{photosTotal !== 1 ? "s" : ""} avec photo.
                Les images se chargent à mesure du défilement.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.flatMap(p =>
                  Array.from({ length: p.nb_photos }, (_, i) => (
                    <figure key={`${p.id}-${i}`} className="bg-surface border border-border rounded-2xl overflow-hidden">
                      <RapportPhoto
                        rapportId={p.id}
                        index={i}
                        alt={`Classe de ${p.nom_tuteur} — ${p.ecole}`}
                        className="aspect-square"
                        onClick={() => setVisionneuse({
                          rapportId: p.id, index: i, nb: p.nb_photos,
                          titre: `${p.nom_tuteur} — ${p.ecole}`,
                          sous: `${fmtDate(p.date_rapport)} · ${p.commune} · ${p.ief}`,
                        })}
                      />
                      <figcaption className="px-3 py-2.5">
                        <p className="text-xs font-semibold text-tx truncate">{p.nom_tuteur}</p>
                        <p className="text-[11px] text-tx-muted truncate">{p.ecole}</p>
                        <p className="text-[11px] text-tx-muted mt-0.5">{fmtDate(p.date_rapport)}</p>
                      </figcaption>
                    </figure>
                  ))
                )}
              </div>
              {photosTotal > PHOTOS_PAGE_SIZE && (
                <div className="bg-surface rounded-2xl border border-border px-5">
                  <Pagination page={photosPage} total={photosTotal}
                    pageSize={PHOTOS_PAGE_SIZE} onChange={setPhotosPage} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Visionneuse plein écran ──────────────────────────────────────────── */}
      {visionneuse && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex flex-col items-center justify-center px-4 py-6"
          onClick={e => { if (e.target === e.currentTarget) setVisionneuse(null); }}
        >
          <div className="flex items-center justify-between w-full max-w-4xl mb-3 gap-4">
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">{visionneuse.titre}</p>
              <p className="text-white/60 text-xs truncate">{visionneuse.sous}</p>
            </div>
            <button
              onClick={() => setVisionneuse(null)}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white flex-shrink-0"
              aria-label="Fermer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="relative w-full max-w-4xl flex-1 min-h-0 flex items-center justify-center">
            <RapportPhoto
              key={`${visionneuse.rapportId}-${visionneuse.index}`}
              rapportId={visionneuse.rapportId}
              index={visionneuse.index}
              immediat
              alt={visionneuse.titre}
              className="max-h-[75vh] w-auto rounded-xl bg-transparent [&>img]:object-contain [&>img]:max-h-[75vh]"
            />
          </div>
          {visionneuse.nb > 1 && (
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => setVisionneuse(v => v && { ...v, index: (v.index - 1 + v.nb) % v.nb })}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
              >
                Précédente
              </button>
              <span className="text-white/70 text-xs">{visionneuse.index + 1} / {visionneuse.nb}</span>
              <button
                onClick={() => setVisionneuse(v => v && { ...v, index: (v.index + 1) % v.nb })}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
              >
                Suivante
              </button>
            </div>
          )}
        </div>
      )}

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

              {/* Photos — chargées une par une depuis le serveur, plus jamais
                  transportées dans la réponse de liste. */}
              {detail.nb_photos > 0 && (
                <Section title={`Photo${detail.nb_photos > 1 ? "s" : ""} de la classe (${detail.nb_photos})`}>
                  <div className={`grid gap-2 ${detail.nb_photos === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
                    {Array.from({ length: detail.nb_photos }, (_, i) => (
                      <RapportPhoto
                        key={i}
                        rapportId={detail.id}
                        index={i}
                        immediat
                        alt={`Photo ${i + 1} de la classe de ${detail.nom_tuteur}`}
                        className={`rounded-xl ${detail.nb_photos === 1 ? "max-h-64 h-64" : "aspect-square"}`}
                        onClick={() => setVisionneuse({
                          rapportId: detail.id, index: i, nb: detail.nb_photos,
                          titre: `${detail.nom_tuteur} — ${detail.ecole}`,
                          sous: `${fmtDate(detail.date_rapport)} · ${detail.commune} · ${detail.ief}`,
                        })}
                      />
                    ))}
                  </div>
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
                        {diffs.map((d, i) => {
                          const isResolved = !!resolutions[d];
                          const isBusy = resolving === d;
                          return (
                            <span
                              key={i}
                              className={`flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium ${
                                isResolved ? "bg-success-soft text-success" : "bg-warn-soft text-warn"
                              }`}
                            >
                              {d}
                              <button
                                onClick={() => toggleResolve(d)}
                                disabled={isBusy}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors disabled:opacity-50 ${
                                  isResolved
                                    ? "bg-success text-white hover:bg-success/80"
                                    : "bg-white/70 text-warn hover:bg-white"
                                }`}
                              >
                                {isBusy ? "…" : isResolved ? "✓ Résolu" : "Régler"}
                              </button>
                            </span>
                          );
                        })}
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

              {/* Questions complémentaires */}
              {detail.reponses_questions && (() => {
                let reponses: Record<string, string> = {};
                try { reponses = JSON.parse(detail.reponses_questions); } catch { /* ignore */ }
                const entries = Object.entries(reponses).filter(([, v]) => v);
                if (entries.length === 0) return null;
                return (
                  <Section title="Questions complémentaires">
                    <div className="space-y-2">
                      {entries.map(([qid, val]) => {
                        const def = questionDefs.find(q => q.id === qid);
                        const label = def?.label ?? "Question";
                        const display = val.includes("||") ? val.split("||").join(", ") : val;
                        return (
                          <div key={qid} className="bg-surface-alt rounded-xl px-4 py-3">
                            <div className="text-[11px] text-tx-muted mb-0.5">{label}</div>
                            <p className="text-sm text-tx">{display}</p>
                          </div>
                        );
                      })}
                    </div>
                  </Section>
                );
              })()}

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

      {showExportModal && (
        <ExportModal
          title="Exporter les rapports journaliers"
          fields={RAPPORT_EXPORT_FIELDS}
          exporting={exporting}
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
        />
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
