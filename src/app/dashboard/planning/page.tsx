"use client";
import { useEffect, useRef, useState } from "react";
import { planningApi, sessionsApi, exportApi } from "@/lib/api";
import { downloadBlob } from "@/lib/csv";
import Pagination from "@/components/Pagination";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const DAYS_PER_PAGE = 3;

/* ── Template CSV téléchargeable ── */
const CSV_TEMPLATE =
  "jour,heure_debut,heure_fin,matiere\n" +
  "Lundi,08:00,10:00,Mathématiques\n" +
  "Lundi,10:00,12:00,Français\n" +
  "Mardi,08:00,10:00,Sciences\n" +
  "Mardi,10:00,12:00,Histoire-Géo\n" +
  "Dimanche,08:00,10:00,Révisions\n";

/* ── Parse CSV côté client pour prévisualisation ── */
const JOURS_MAP: Record<string, number> = {
  lundi: 0, mardi: 1, mercredi: 2, jeudi: 3, vendredi: 4, samedi: 5, dimanche: 6,
};
function parseJour(raw: string): number {
  const n = parseInt(raw);
  if (!isNaN(n)) return n;
  return JOURS_MAP[raw.toLowerCase().trim()] ?? -1;
}
function parseCSVPreview(text: string): { rows: any[]; errors: string[] } {
  const lines = text.replace(/\r/g, "").trim().split("\n");
  if (lines.length < 2) return { rows: [], errors: ["Fichier vide ou sans données."] };
  // Supprimer BOM éventuel
  const header = lines[0].replace(/^﻿/, "").split(",").map(h => h.trim().toLowerCase());
  const required = ["jour", "heure_debut", "heure_fin"];
  const missing = required.filter(r => !header.includes(r));
  if (missing.length) return { rows: [], errors: [`Colonnes manquantes : ${missing.join(", ")}`] };

  const rows: any[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, i) => {
    if (!line.trim()) return;
    const vals = line.split(",").map(v => v.trim());
    const obj = Object.fromEntries(header.map((h, j) => [h, vals[j] ?? ""]));
    const jour = parseJour(obj.jour ?? "");
    if (jour < 0 || jour > 6) { errors.push(`Ligne ${i + 2} : jour invalide « ${obj.jour} »`); return; }
    rows.push({ jour, heure_debut: obj.heure_debut, heure_fin: obj.heure_fin, matiere: obj.matiere || "—" });
  });
  return { rows, errors };
}

interface Seg {
  id: string;
  session_id: string;
  semaine?: number | null;
  jour: number;
  heure_debut: string;
  heure_fin: string;
  matiere?: string;
}

const EMPTY = { session_id: "", semaine: "", jour: 0, heure_debut: "08:00", heure_fin: "10:00", matiere: "" };

export default function PlanningPage() {
  const [segs, setSegs] = useState<Seg[]>([]);
  const [sessId, setSessId] = useState("");
  const [sessName, setSessName] = useState("");
  const [modal, setModal] = useState<null | "create" | Seg>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<Seg | null>(null);
  const [page, setPage] = useState(1);
  const [filterJour, setFilterJour] = useState<string>("");
  const [filterMatiere, setFilterMatiere] = useState<string>("");
  const [filterSemaine, setFilterSemaine] = useState<string>("");
  const [importSemaine, setImportSemaine] = useState<string>("");

  /* ── Export CSV ── */
  const [exporting, setExporting] = useState(false);
  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const res = await exportApi.planning();
      downloadBlob(res.data, "planning.csv");
    } catch { /* silencieux */ }
    finally { setExporting(false); }
  };

  /* ── Import CSV ── */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; errors: any[] } | null>(null);
  const [importing, setImporting] = useState(false);

  const resetImport = () => {
    setImportFile(null); setImportPreview([]); setImportErrors([]);
    setImportResult(null); setImporting(false); setImportSemaine("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImportFile(f); setImportResult(null); setImportPreview([]); setImportErrors([]);

    const name = f.name.toLowerCase();
    const isPdf = name.endsWith(".pdf") || f.type === "application/pdf";
    const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls") || f.type.includes("excel") || f.type.includes("officedocument.spreadsheetml");
    
    if (isPdf || isExcel) return; // PDF/Excel → preview impossible côté client, le serveur s'en charge

    const reader = new FileReader();
    reader.onload = ev => {
      const { rows, errors } = parseCSVPreview(ev.target?.result as string);
      setImportPreview(rows); setImportErrors(errors);
    };
    reader.readAsText(f, "utf-8");
  };

  const handleImport = async () => {
    if (!importFile) return;
    if (!sessId) {
      setImportErrors(["Aucune session active trouvée. Créez ou activez une session de programme avant d'importer un planning."]);
      return;
    }
    setImporting(true);
    try {
      const res = await planningApi.import(
        sessId,
        importFile,
        importSemaine ? Number(importSemaine) : undefined
      );
      setImportResult(res.data);
      if (res.data.imported > 0) loadSegs();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      let msg: string;
      if (!e?.response) {
        msg = "Impossible de joindre le serveur. Vérifiez votre connexion et que le serveur est démarré.";
      } else if (Array.isArray(detail)) {
        msg = detail.map((d: any) => d.msg ?? JSON.stringify(d)).join(" · ");
      } else if (detail) {
        msg = String(detail);
      } else {
        msg = `Erreur ${e.response.status} lors de l'import.`;
      }
      setImportErrors([msg]);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "planning_modele.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Chargement session active ───────────────────────────────────────────────
  useEffect(() => {
    sessionsApi.list().then(r => {
      const active = (r.data.items ?? []).find((s: any) => s.status === "active");
      if (active) { setSessId(active.id); setSessName(active.name); }
    }).catch(() => { });
  }, []);

  const loadSegs = () =>
    planningApi.list(sessId || undefined)
      .then(r => { setSegs(r.data.items ?? []); setPage(1); })
      .catch(() => { });

  useEffect(() => { if (sessId) loadSegs(); }, [sessId]);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const save = async () => {
    setSaveError(null);
    setLoading(true);
    try {
      // Sanitize : matiere vide → null (le backend attend Optional[str])
      const payload = {
        ...form,
        matiere: form.matiere || undefined,
        // création : semaine absente si vide · édition : null explicite pour effacer
        semaine: form.semaine !== "" ? Number(form.semaine) : (modal === "create" ? undefined : null),
      };
      if (modal === "create") await planningApi.create(payload);
      else await planningApi.update((modal as Seg).id, payload);
      loadSegs();
      setModal(null);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        setSaveError(detail.map((e: any) => e.msg ?? String(e)).join(" · "));
      } else {
        setSaveError(detail ?? "Une erreur est survenue. Vérifiez les champs et réessayez.");
      }
    } finally { setLoading(false); }
  };

  const confirmDelete = async () => {
    if (!delTarget) return;
    setLoading(true);
    try { await planningApi.delete(delTarget.id); loadSegs(); setDelTarget(null); }
    finally { setLoading(false); }
  };

  // ── Données groupées & paginées ─────────────────────────────────────────────
  const matieres = Array.from(
    new Set(segs.map(s => s.matiere).filter((m): m is string => !!m))
  ).sort();

  const semaines = Array.from(
    new Set(segs.map(s => s.semaine).filter((s): s is number => s != null))
  ).sort((a, b) => a - b);

  const hasFilters = !!(filterJour || filterMatiere || filterSemaine);

  const filteredSegs = segs.filter(s => {
    const matchJour = !filterJour || s.jour === Number(filterJour);
    const matchMatiere = !filterMatiere || (s.matiere ?? "") === filterMatiere;
    const matchSemaine =
      !filterSemaine ||
      (filterSemaine === "none" ? s.semaine == null : s.semaine === Number(filterSemaine));
    return matchJour && matchMatiere && matchSemaine;
  });

  const segsByDay = filteredSegs.reduce<Record<number, Seg[]>>((acc, s) => {
    (acc[s.jour] ??= []).push(s);
    return acc;
  }, {});

  const activeDays = Object.keys(segsByDay).map(Number).sort((a, b) => a - b);
  const currentPage = Math.min(Math.max(1, page), Math.max(1, Math.ceil(activeDays.length / DAYS_PER_PAGE)));
  const visibleDays = activeDays.slice((currentPage - 1) * DAYS_PER_PAGE, currentPage * DAYS_PER_PAGE);

  return (
    <div className="flex flex-col min-h-full px-7 pb-7">

      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Gestion Planning</h1>
          <p className="text-tx-muted text-sm mt-0.5">
            {hasFilters
              ? `${filteredSegs.length} créneau${filteredSegs.length !== 1 ? "x" : ""} sur ${segs.length} · ${activeDays.length} jour${activeDays.length !== 1 ? "s" : ""}`
              : `${segs.length} créneau${segs.length !== 1 ? "x" : ""} · ${activeDays.length} jour${activeDays.length !== 1 ? "s" : ""}`}
            {sessName && <span className="ml-2 text-brand font-medium">· {sessName}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Exporter CSV */}
          <button
            onClick={handleExportCsv}
            disabled={exporting || !sessId}
            className="flex items-center gap-2 bg-surface border border-border hover:bg-surface-alt text-tx px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {exporting ? "Export…" : "Exporter CSV"}
          </button>
          <button
            onClick={() => { resetImport(); setShowImport(true); }}
            disabled={!sessId}
            className="flex items-center gap-2 bg-surface border border-border hover:bg-surface-alt text-tx px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Importer
          </button>
          <button
            onClick={() => { setForm({ ...EMPTY, session_id: sessId }); setSaveError(null); setModal("create"); }}
            className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Ajouter créneau
          </button>
        </div>
      </div>

      {/* ── Alerte session inactive ─────────────────────────────────────────── */}
      {!sessId && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-warn-soft text-warn text-sm font-medium">
          Aucune session active. Activez une session pour gérer le planning.
        </div>
      )}

      {/* ── Barre de filtres ──────────────────────────────────────────────── */}
      {segs.length > 0 && (
        <div className="flex gap-3 mb-5">
          {/* Filtre Semaine */}
          <div className="relative">
            <select value={filterSemaine} onChange={e => { setFilterSemaine(e.target.value); setPage(1); }}
              className={`pl-3 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none min-w-[150px] ${filterSemaine ? "border-brand text-brand font-medium" : "border-border text-tx"
                }`}>
              <option value="">Toutes les semaines</option>
              {semaines.map(s => <option key={s} value={s}>Semaine {s}</option>)}
              <option value="none">Sans semaine</option>
            </select>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>

          {/* Filtre Jour */}
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <select value={filterJour} onChange={e => { setFilterJour(e.target.value); setPage(1); }}
              className={`pl-8 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none min-w-[140px] ${filterJour ? "border-brand text-brand font-medium" : "border-border text-tx"
                }`}>
              <option value="">Tous les jours</option>
              {JOURS.map((j, i) => <option key={i} value={i}>{j}</option>)}
            </select>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>

          {/* Filtre Matière */}
          {matieres.length > 0 && (
            <div className="relative">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <select value={filterMatiere} onChange={e => { setFilterMatiere(e.target.value); setPage(1); }}
                className={`pl-8 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none min-w-[160px] ${filterMatiere ? "border-brand text-brand font-medium" : "border-border text-tx"
                  }`}>
                <option value="">Toutes les matières</option>
                {matieres.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          )}

          {/* Reset */}
          {hasFilters && (
            <button onClick={() => { setFilterJour(""); setFilterMatiere(""); setFilterSemaine(""); setPage(1); }}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-brand/30 bg-brand-soft text-brand text-sm font-medium hover:bg-brand hover:text-white transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {/* ── Emploi du temps groupé par jour ────────────────────────────────── */}
      {segs.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border flex-1 flex flex-col items-center justify-center gap-3 py-20">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-tx-muted/40">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p className="text-tx-muted text-sm">Aucun créneau pour l'instant</p>
          {sessId && (
            <button
              onClick={() => { setForm({ ...EMPTY, session_id: sessId }); setSaveError(null); setModal("create"); }}
              className="mt-1 text-xs text-brand hover:underline font-medium">
              + Ajouter le premier créneau
            </button>
          )}
        </div>
      ) : activeDays.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border flex-1 flex flex-col items-center justify-center gap-3 py-20">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-tx-muted/40">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p className="text-tx-muted text-sm">Aucun créneau ne correspond aux filtres.</p>
          <button onClick={() => { setFilterJour(""); setFilterMatiere(""); setFilterSemaine(""); setPage(1); }}
            className="mt-1 text-xs text-brand hover:underline font-medium">
            Effacer les filtres
          </button>
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
                        onClick={() => { setForm({ ...EMPTY, session_id: sessId, jour }); setSaveError(null); setModal("create"); }}
                        className="flex items-center gap-1 text-xs text-brand hover:text-brand-dark font-semibold transition-colors">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        Ajouter
                      </button>
                    </div>
                  </div>

                  {/* Tableau Heure | Activité | Actions */}
                  <table className="w-full text-sm">
                    <colgroup><col className="w-[22%]" /><col /><col className="w-[160px]" /></colgroup>
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
                          className={`border-t border-border hover:bg-surface-alt transition-colors ${i % 2 !== 0 ? "bg-surface-alt/40" : ""
                            }`}>
                          <td className="px-5 py-3 font-mono text-xs text-tx-muted whitespace-nowrap">
                            {s.heure_debut} – {s.heure_fin}
                          </td>
                          <td className="px-5 py-3 text-tx font-medium">
                            <span className="inline-flex items-center gap-2">
                              {s.matiere ?? (
                                <span className="text-tx-muted italic">Sans titre</span>
                              )}
                              {s.semaine != null && (
                                <span className="text-[10px] font-bold uppercase tracking-wide bg-brand-soft text-brand px-1.5 py-0.5 rounded-md">
                                  S{s.semaine}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => {
                                  setForm({
                                    session_id: s.session_id,
                                    semaine: s.semaine != null ? String(s.semaine) : "",
                                    jour: s.jour,
                                    heure_debut: s.heure_debut,
                                    heure_fin: s.heure_fin,
                                    matiere: s.matiere ?? "",
                                  });
                                  setSaveError(null);
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
          <div className="mt-4">
            <Pagination page={currentPage} total={activeDays.length} pageSize={DAYS_PER_PAGE} onChange={setPage} />
          </div>
        </>
      )}

      {/* ── Modal Créer / Modifier ───────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-base font-bold text-tx mb-5">
              {modal === "create" ? "Nouveau créneau" : "Modifier le créneau"}
            </h2>
            {saveError && (
              <div className="mb-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-danger-soft border border-danger/20 text-danger text-sm">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                <span>{saveError}</span>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-tx mb-1">Semaine concernée</label>
                <select
                  value={form.semaine}
                  onChange={e => setForm(f => ({ ...f, semaine: e.target.value }))}
                  className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition">
                  <option value="">Toutes les semaines</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(s => (
                    <option key={s} value={s}>Semaine {s}</option>
                  ))}
                </select>
                <p className="text-xs text-tx-muted mt-1">
                  Le planning ne sera affiché aux tuteurs que pour la semaine choisie.
                </p>
              </div>
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
                  ["Heure de fin", "heure_fin"],
                  ["Activité", "matiere"],
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
                onClick={() => { setModal(null); setSaveError(null); }}
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

      {/* ── Modal Import CSV ────────────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* Titre */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-tx">Importer un planning</h2>
                <p className="text-xs text-tx-muted mt-0.5">Emploi du temps PDF Ndaw Wune · ou fichier CSV</p>
              </div>
              <button onClick={() => { setShowImport(false); resetImport(); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-alt text-tx-muted transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Zone upload + modèle */}
            {!importResult && (
              <>
                {/* Semaine cible de l'import */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-tx mb-1">Semaine concernée</label>
                  <select
                    value={importSemaine}
                    onChange={e => setImportSemaine(e.target.value)}
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition">
                    <option value="">Toutes les semaines (remplace tout le planning)</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(s => (
                      <option key={s} value={s}>Semaine {s} (remplace uniquement cette semaine)</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  {/* Bouton sélectionner fichier */}
                  <label className="flex-1 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-6 cursor-pointer hover:border-brand hover:bg-brand/5 transition-colors">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-tx-muted">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span className="text-sm text-tx-muted text-center px-2">
                      {importFile
                        ? <span className="text-brand font-semibold">{importFile.name}</span>
                        : <><span className="font-medium text-tx">Cliquez pour choisir un fichier</span><br /><span className="text-xs">Fichier Excel (.xlsx, .xls), CSV ou PDF<br />Le fichier sera traité automatiquement</span></>
                      }
                    </span>
                    <input ref={fileInputRef} type="file" accept=".pdf,.csv,.xlsx,.xls,text/csv,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      className="hidden" onChange={handleFileChange} />
                  </label>

                  {/* Télécharger le modèle */}
                  <button onClick={downloadTemplate}
                    className="flex flex-col items-center gap-1.5 px-4 py-3 border border-border rounded-xl hover:bg-surface-alt text-xs text-tx-muted font-medium transition-colors whitespace-nowrap">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Modèle CSV
                  </button>
                </div>

                {/* Erreurs de parsing */}
                {importErrors.length > 0 && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-danger-soft border border-danger/20 text-danger text-xs space-y-0.5">
                    {importErrors.map((e, i) => <p key={i}>⚠ {e}</p>)}
                  </div>
                )}

                {/* Prévisualisation */}
                {importPreview.length > 0 && importErrors.length === 0 && (
                  <div className="flex-1 overflow-auto rounded-xl border border-border mb-4">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-alt border-b border-border">
                        <tr>
                          {["Jour", "Début", "Fin", "Activité"].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-tx-muted uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((r, i) => (
                          <tr key={i} className="border-t border-border hover:bg-surface-alt/50">
                            <td className="px-4 py-2 font-medium text-tx">{JOURS[r.jour] ?? r.jour}</td>
                            <td className="px-4 py-2 font-mono text-xs text-tx-muted">{r.heure_debut}</td>
                            <td className="px-4 py-2 font-mono text-xs text-tx-muted">{r.heure_fin}</td>
                            <td className="px-4 py-2 text-tx">{r.matiere}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="px-4 py-2 text-xs text-tx-muted border-t border-border">
                      {importPreview.length} créneau{importPreview.length !== 1 ? "x" : ""} détecté{importPreview.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Résultat après import */}
            {importResult && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 py-6">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${importResult.imported > 0 ? "bg-success-soft" : "bg-warn-soft"}`}>
                  {importResult.imported > 0
                    ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success"><path d="M20 6 9 17l-5-5" /></svg>
                    : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-warn"><path d="M12 9v4" /><circle cx="12" cy="17" r=".5" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
                  }
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-tx">
                    {importResult.imported} créneau{importResult.imported !== 1 ? "x" : ""} importé{importResult.imported !== 1 ? "s" : ""}
                  </p>
                  {importResult.errors.length > 0 && (
                    <p className="text-sm text-warn mt-1">{importResult.errors.length} ligne{importResult.errors.length !== 1 ? "s" : ""} ignorée{importResult.errors.length !== 1 ? "s" : ""}</p>
                  )}
                </div>
                {importResult.errors.length > 0 && (
                  <div className="w-full px-4 py-3 rounded-xl bg-warn-soft text-warn text-xs space-y-0.5">
                    {importResult.errors.map((e: any, i: number) => (
                      <p key={i}>Ligne {e.row} : {e.error}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2 border-t border-border mt-2">
              <button
                onClick={() => { setShowImport(false); resetImport(); }}
                className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">
                {importResult ? "Fermer" : "Annuler"}
              </button>
              {!importResult && (
                <button
                  onClick={handleImport}
                  disabled={!importFile || importErrors.length > 0 || importing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {importing
                    ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>Importation…</>
                    : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>Importer {importPreview.length > 0 ? `(${importPreview.length} créneaux)` : importFile?.name.endsWith(".pdf") ? "le PDF" : ""}</>
                  }
                </button>
              )}
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
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" /><path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
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
