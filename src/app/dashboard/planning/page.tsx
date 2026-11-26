"use client";
import { useEffect, useRef, useState } from "react";
import { planningApi, sessionsApi, exportApi, schoolsApi } from "@/lib/api";
import { errorDetail } from "@/lib/notify";
import { downloadBlob } from "@/lib/csv";
import Pagination from "@/components/Pagination";

const JOURS = Array.from({ length: 7 }, (_, i) => `Jour ${i + 1}`);
const DAYS_PER_PAGE = 3;

/* ── Template CSV téléchargeable ── */
const CSV_TEMPLATE =
  "jour,heure_debut,heure_fin,matiere\n" +
  "0,16:00,16:05,Promesse Ndaw Wune\n" +
  "0,16:05,16:40,Leçon Maths\n" +
  "0,16:40,16:45,Chanson éducative de transition\n" +
  "0,16:45,16:50,Chanson alphabet\n" +
  "0,16:50,17:00,Cahier récits\n" +
  "0,17:00,17:45,Leçon Lecture\n" +
  "0,17:45,18:00,Lecture indépendante avec feedback correctif\n";

/* ── Parse CSV côté client pour prévisualisation ── */
const JOURS_MAP: Record<string, number> = {
  lundi: 0, mardi: 1, mercredi: 2, jeudi: 3, vendredi: 4, samedi: 5, dimanche: 6,
  // Format séquentiel
  ...Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`jour ${i + 1}`, i])),
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
  /** Lot L9 : créneau visible uniquement par les écoles avec FLS. */
  reserve_fls?: boolean;
}

const EMPTY = { session_id: "", semaine: "", jour: 0, heure_debut: "08:00", heure_fin: "10:00", matiere: "", reserve_fls: false };

/* ── Lot L9 : écoles avec / sans FLS ── */
type TypeEcole = "tous" | "fls" | "sans_fls";
const TYPES_ECOLE: { value: TypeEcole; label: string }[] = [
  { value: "tous", label: "Toutes" },
  { value: "fls", label: "Écoles avec FLS" },
  { value: "sans_fls", label: "Écoles sans FLS" },
];
/** Même règle que le serveur : « Français langue seconde » ou « FLS » dans l'intitulé. */
const estMatiereFls = (m?: string | null) => {
  const t = (m ?? "").toLowerCase();
  return t.includes("langue seconde") || /\bfls\b/.test(t);
};
interface FlsResume { avec_fls: number; sans_fls: number; non_renseignees: number; creneaux_reserves_fls: number }
interface FlsImportResult {
  dry_run: boolean;
  lignes_fichier: number;
  avec_fls: number;
  sans_fls: number;
  a_modifier: number;
  ief_completees: number;
  erreurs: { feuille: string; ligne: number; erreur: string }[];
  trouvees: {
    nom_fichier: string; ief_fichier?: string | null; fls: boolean; id: string; nom: string; ief?: string | null;
    fls_actuel: boolean | null; change: boolean; ief_differente?: boolean; ief_manquante?: boolean;
  }[];
  introuvables: {
    nom_fichier: string; ief_fichier?: string | null; fls: boolean;
    suggestion?: string | null; suggestion_id?: string | null; suggestion_ief?: string | null; raison?: string;
  }[];
  associations_appliquees?: number;
  ambigues: { nom_fichier: string; ief_fichier?: string | null; fls: boolean; ecoles: { id: string; nom: string; ief?: string | null }[]; raison?: string }[];
  ecoles_sans_type_restantes?: number;
}
interface EcoleRef { id: string; name: string; region?: string | null; archived_at?: string | null }
/** « IEF Kaolack-commune » ≈ « kaolack commune » : même clé que le serveur, en plus simple. */
const cleIef = (v?: string | null) =>
  (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/^ief /, "");
const flsLabel = (v: boolean | null | undefined) => (v === true ? "Avec FLS" : v === false ? "Sans FLS" : "Non renseigné");

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
  const [typeEcole, setTypeEcole] = useState<TypeEcole>("tous");
  const [flsResume, setFlsResume] = useState<FlsResume | null>(null);
  // La case FLS suit la matière tant que l'utilisateur ne l'a pas modifiée lui-même.
  const [flsTouched, setFlsTouched] = useState(false);

  /* ── Import de la répartition FLS (lot L9) ── */
  const flsFileRef = useRef<HTMLInputElement>(null);
  const [showFlsImport, setShowFlsImport] = useState(false);
  const [flsFile, setFlsFile] = useState<File | null>(null);
  const [flsCompleterIef, setFlsCompleterIef] = useState(true);
  const [flsApercu, setFlsApercu] = useState<FlsImportResult | null>(null);
  const [flsResultat, setFlsResultat] = useState<FlsImportResult | null>(null);
  const [flsError, setFlsError] = useState<string | null>(null);
  const [flsBusy, setFlsBusy] = useState(false);
  // Choix de l'admin pour les écoles introuvables ou ambiguës : { nom dans le fichier : id école }.
  const [flsChoix, setFlsChoix] = useState<Record<string, string>>({});
  const [flsChoixModifies, setFlsChoixModifies] = useState(false);
  const [ecolesRef, setEcolesRef] = useState<EcoleRef[]>([]);
  const choisirEcole = (nomFichier: string, id: string | null) => {
    setFlsChoix(c => {
      const n = { ...c };
      if (id) n[nomFichier] = id; else delete n[nomFichier];
      return n;
    });
    setFlsChoixModifies(true);
  };

  /* ── Export CSV ── */
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const handleExportCsv = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await exportApi.planning({
        session_id: sessId || undefined,
        semaine: filterSemaine !== "" ? Number(filterSemaine) : undefined,
        // APP-34 : le fichier reflète exactement les filtres affichés.
        jour: filterJour !== "" ? Number(filterJour) : undefined,
        matiere: filterMatiere || undefined,
      });
      downloadBlob(res.data, "planning.csv");
    } catch (e) {
      setExportError(`L'export du planning a échoué${errorDetail(e) ? ` : ${errorDetail(e)}` : ""}. Réessayez dans un instant.`);
    } finally { setExporting(false); }
  };

  /* ── Import CSV ── */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; replaced: number; errors: any[]; perimetre: string } | null>(null);
  // Rapport V2, APP-26 : aperçu serveur (dry_run) obligatoire avant remplacement.
  const [importApercu, setImportApercu] = useState<{
    perimetre: string; a_remplacer: number; valides: number; errors: { row: any; error: string }[];
    segments: { jour: number; heure_debut: string; heure_fin: string; matiere?: string; semaine?: number }[];
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importEstRepartitionFls, setImportEstRepartitionFls] = useState(false);

  const resetImport = () => {
    setImportFile(null); setImportPreview([]); setImportErrors([]); setImportApercu(null);
    setImportResult(null); setImporting(false); setImportSemaine(""); setImportEstRepartitionFls(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImportFile(f); setImportResult(null); setImportPreview([]); setImportErrors([]); setImportApercu(null);
    setImportEstRepartitionFls(false);

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

  /** Étape 1 : aperçu serveur (rien n'est modifié). Étape 2 : remplacement confirmé. */
  const handleImport = async () => {
    if (!importFile) return;
    if (!sessId) {
      setImportErrors(["Aucune session active trouvée. Créez ou activez une session de programme avant d'importer un planning."]);
      return;
    }
    const semaine = importSemaine ? Number(importSemaine) : undefined;
    setImporting(true);
    setImportErrors([]);
    try {
      if (!importApercu) {
        const res = await planningApi.import(sessId, importFile, semaine, { dryRun: true });
        setImportApercu(res.data);
      } else {
        const res = await planningApi.import(sessId, importFile, semaine, {
          accepterErreurs: importApercu.errors.length > 0,
        });
        setImportResult(res.data);
        setImportApercu(null);
        if (res.data.imported > 0) { loadSegs(); loadFlsResume(); }
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const lignes: string[] = [errorDetail(e) ?? "Erreur lors de l'import."];
      if (detail && typeof detail === "object" && Array.isArray(detail.errors)) {
        lignes.push(...detail.errors.slice(0, 30).map((x: any) => `Ligne ${x.row} : ${x.error}`));
      }
      // 409 PLANNING_IMPORT_PARTIEL : le serveur renvoie l'aperçu à jour.
      if (detail?.code === "PLANNING_IMPORT_PARTIEL") setImportApercu(detail);
      else setImportApercu(null);
      // Lot L9 : fichier de répartition FLS envoyé au mauvais import.
      setImportEstRepartitionFls(detail?.code === "FICHIER_REPARTITION_FLS");
      setImportErrors(lignes);
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
    planningApi.list(sessId || undefined, undefined, typeEcole)
      .then(r => { setSegs(r.data.items ?? []); setPage(1); })
      .catch(() => { });

  const loadFlsResume = () =>
    planningApi.flsResume(sessId || undefined)
      .then(r => setFlsResume(r.data))
      .catch(() => setFlsResume(null));

  // Lot L10 : « Répartition FLS » depuis Gestion École ouvre directement l'import.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("import_fls") === "1") openFlsImport();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (sessId) loadSegs(); }, [sessId, typeEcole]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (sessId) loadFlsResume(); }, [sessId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Import de la répartition FLS ── */
  const resetFlsImport = (fichier: File | null = null) => {
    setFlsFile(fichier); setFlsCompleterIef(true); setFlsApercu(null); setFlsResultat(null);
    setFlsError(null); setFlsBusy(false); setFlsChoix({}); setFlsChoixModifies(false);
    if (flsFileRef.current) flsFileRef.current.value = "";
  };
  const openFlsImport = (fichier: File | null = null) => {
    resetFlsImport(fichier); setShowFlsImport(true);
    schoolsApi.list({ limit: 10000 })
      .then(r => setEcolesRef(((r.data.items ?? []) as EcoleRef[]).filter(e => !e.archived_at)))
      .catch(() => setEcolesRef([]));
  };

  /** Étape 1 : aperçu (dry_run). Étape 2 : application avec le même fichier. */
  const handleFlsImport = async () => {
    if (!flsFile) return;
    setFlsBusy(true); setFlsError(null);
    try {
      if (!flsApercu || flsChoixModifies) {
        const res = await planningApi.importFls(flsFile, { dryRun: true, completerIef: flsCompleterIef, associations: flsChoix });
        setFlsApercu(res.data);
        setFlsChoixModifies(false);
      } else {
        const res = await planningApi.importFls(flsFile, { dryRun: false, completerIef: flsCompleterIef, associations: flsChoix });
        setFlsResultat(res.data);
        setFlsApercu(null);
        loadFlsResume();
        if (typeEcole !== "tous") loadSegs();
      }
    } catch (e) {
      setFlsError(errorDetail(e) ?? "Erreur lors de l'import de la répartition FLS.");
    } finally { setFlsBusy(false); }
  };

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
      loadFlsResume();
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
    try { await planningApi.delete(delTarget.id); loadSegs(); loadFlsResume(); setDelTarget(null); }
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
    <div className="flex flex-col min-h-full flex-shrink-0 px-7 pb-7">

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
          {exportError && <p className="text-danger text-sm mt-1" role="alert">{exportError}</p>}
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
            onClick={() => openFlsImport()}
            className="flex items-center gap-2 bg-surface border border-border hover:bg-surface-alt text-tx px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-5 9 5-9 5-9-5z" /><path d="M5 10v6c0 2 3 4 7 4s7-2 7-4v-6" />
            </svg>
            Importer la répartition FLS
          </button>
          <button
            onClick={() => { setForm({ ...EMPTY, session_id: sessId }); setFlsTouched(false); setSaveError(null); setModal("create"); }}
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

      {/* ── Lot L9 : type d'école (avec / sans FLS) ────────────────────────── */}
      {sessId && (
        <div className="mb-5 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-tx">Type d&apos;école</span>
            <div role="radiogroup" aria-label="Type d'école" className="inline-flex rounded-xl border border-border bg-surface p-1">
              {TYPES_ECOLE.map(t => (
                <button
                  key={t.value}
                  role="radio"
                  aria-checked={typeEcole === t.value}
                  onClick={() => setTypeEcole(t.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeEcole === t.value ? "bg-brand text-white" : "text-tx-muted hover:bg-surface-alt"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {typeEcole === "sans_fls" && (
              <span className="text-xs text-tx-muted">Emploi du temps tel que le voient les écoles sans FLS (créneaux réservés FLS masqués).</span>
            )}
            {typeEcole === "fls" && (
              <span className="text-xs text-tx-muted">Emploi du temps complet, tel que le voient les écoles avec FLS.</span>
            )}
          </div>
          {flsResume && (
            <div className="px-4 py-2.5 rounded-xl bg-surface border border-border text-sm text-tx flex flex-wrap gap-x-2 gap-y-1">
              <span><b>{flsResume.avec_fls}</b> école{flsResume.avec_fls !== 1 ? "s" : ""} avec FLS</span>
              <span className="text-tx-muted">·</span>
              <span><b>{flsResume.sans_fls}</b> sans FLS</span>
              <span className="text-tx-muted">·</span>
              <span className={flsResume.non_renseignees > 0 ? "text-warn" : ""}>
                <b>{flsResume.non_renseignees}</b> non renseignée{flsResume.non_renseignees !== 1 ? "s" : ""} (voient tout l&apos;emploi du temps)
              </span>
              <span className="text-tx-muted">·</span>
              <span><b>{flsResume.creneaux_reserves_fls}</b> créneau{flsResume.creneaux_reserves_fls !== 1 ? "x" : ""} réservé{flsResume.creneaux_reserves_fls !== 1 ? "s" : ""} FLS</span>
            </div>
          )}
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
              onClick={() => { setForm({ ...EMPTY, session_id: sessId }); setFlsTouched(false); setSaveError(null); setModal("create"); }}
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
                        onClick={() => { setForm({ ...EMPTY, session_id: sessId, jour }); setFlsTouched(false); setSaveError(null); setModal("create"); }}
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
                              {s.reserve_fls && (
                                <span title="Visible uniquement par les écoles avec FLS"
                                  className="text-[10px] font-bold uppercase tracking-wide bg-primary-soft text-primary px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                  FLS uniquement
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
                                    reserve_fls: s.reserve_fls ?? estMatiereFls(s.matiere),
                                  });
                                  // Modification : on garde la valeur enregistrée.
                                  setFlsTouched(true);
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
                    onChange={e => {
                      const v = e.target.value;
                      setForm(f => ({
                        ...f,
                        [key]: v,
                        ...(key === "matiere" && !flsTouched ? { reserve_fls: estMatiereFls(v) } : {}),
                      }));
                    }}
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition"
                  />
                </div>
              ))}
              <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={form.reserve_fls}
                  onChange={e => { setFlsTouched(true); setForm(f => ({ ...f, reserve_fls: e.target.checked })); }}
                  className="mt-0.5 w-4 h-4 accent-brand"
                />
                <span>
                  <span className="block text-sm font-medium text-tx">Réservé aux écoles avec FLS</span>
                  <span className="block text-xs text-tx-muted">Les tuteurs des écoles sans FLS ne verront pas ce créneau.</span>
                </span>
              </label>
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
                <p className="text-xs text-tx-muted mt-0.5">PDF Ndaw Wune · Excel · CSV (colonnes : jour, heure_debut, heure_fin, matiere)</p>
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
                    onChange={e => { setImportSemaine(e.target.value); setImportApercu(null); }}
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
                        : <><span className="font-medium text-tx">Cliquez ou glissez un fichier ici</span><br /><span className="text-xs">PDF Ndaw Wune, Excel (.xlsx) ou CSV<br />L'emploi du temps sera importé automatiquement</span></>
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
                    {importEstRepartitionFls && (
                      <button
                        onClick={() => { const f = importFile; setShowImport(false); resetImport(); openFlsImport(f); }}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-dark transition-colors">
                        Ouvrir l&apos;import de la répartition FLS avec ce fichier
                      </button>
                    )}
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

            {/* Aperçu serveur avant remplacement */}
            {importApercu && !importResult && (
              <div className="mb-4 rounded-xl border border-border p-4 overflow-auto">
                <p className="text-sm font-bold text-tx">Aperçu — rien n&apos;est encore modifié</p>
                <ul className="text-sm text-tx mt-2 space-y-0.5">
                  <li>Périmètre remplacé : <b>{importApercu.perimetre}</b></li>
                  <li>Créneaux actuels supprimés : <b>{importApercu.a_remplacer}</b></li>
                  <li>Créneaux valides importés : <b>{importApercu.valides}</b></li>
                  {importApercu.errors.length > 0 && (
                    <li className="text-danger">Lignes invalides (non importées) : <b>{importApercu.errors.length}</b></li>
                  )}
                </ul>
                {importApercu.errors.length > 0 && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-danger-soft text-danger text-xs space-y-0.5 max-h-32 overflow-auto">
                    {importApercu.errors.map((e, i) => <p key={i}>Ligne {e.row} : {e.error}</p>)}
                  </div>
                )}
                <table className="w-full text-xs mt-3">
                  <thead><tr className="text-tx-muted">
                    {["Sem.", "Jour", "Début", "Fin", "Activité"].map(h => <th key={h} className="text-left py-1 pr-3">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {importApercu.segments.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="py-1 pr-3">{r.semaine ?? "—"}</td>
                        <td className="py-1 pr-3">{JOURS[r.jour] ?? r.jour}</td>
                        <td className="py-1 pr-3 font-mono">{r.heure_debut}</td>
                        <td className="py-1 pr-3 font-mono">{r.heure_fin}</td>
                        <td className="py-1">{r.matiere ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importApercu.valides > 50 && <p className="text-xs text-tx-muted mt-1">… {importApercu.valides - 50} autre(s) créneau(x).</p>}
              </div>
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
                  <p className="text-xs text-tx-muted mt-1">
                    {importResult.perimetre} · {importResult.replaced} ancien(s) créneau(x) remplacé(s)
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
                  disabled={!importFile || importing || (!importApercu && importErrors.length > 0)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {importing
                    ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>Importation…</>
                    : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>{importApercu
                      ? (importApercu.errors.length > 0
                          ? `Remplacer malgré ${importApercu.errors.length} ligne(s) invalide(s)`
                          : `Confirmer le remplacement (${importApercu.valides} créneaux)`)
                      : "Analyser le fichier"}</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Import répartition FLS (lot L9) ───────────────────────────── */}
      {showFlsImport && (() => {
        const r = flsResultat ?? flsApercu;
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-tx">Importer la répartition FLS</h2>
                  <p className="text-xs text-tx-muted mt-0.5">Fichier Excel (.xlsx) listant les écoles avec et sans français langue seconde.</p>
                </div>
                <button onClick={() => { setShowFlsImport(false); resetFlsImport(); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-alt text-tx-muted transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-auto">
                {!flsResultat && (
                  <>
                    <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-5 cursor-pointer hover:border-brand hover:bg-brand/5 transition-colors mb-3">
                      <span className="text-sm text-tx-muted text-center px-2">
                        {flsFile
                          ? <span className="text-brand font-semibold">{flsFile.name}</span>
                          : <><span className="font-medium text-tx">Choisir le fichier de répartition</span><br /><span className="text-xs">Excel (.xlsx)</span></>}
                      </span>
                      <input ref={flsFileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) { setFlsFile(f); setFlsApercu(null); setFlsError(null); } }} />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-tx mb-3 cursor-pointer select-none">
                      <input type="checkbox" checked={flsCompleterIef}
                        onChange={e => { setFlsCompleterIef(e.target.checked); setFlsApercu(null); }}
                        className="w-4 h-4 accent-brand" />
                      Compléter l&apos;IEF des écoles qui n&apos;en ont pas
                    </label>
                  </>
                )}

                {flsError && (
                  <div className="mb-3 px-4 py-3 rounded-xl bg-danger-soft border border-danger/20 text-danger text-sm">{flsError}</div>
                )}

                {r && (
                  <div className="space-y-4">
                    <div className={`px-4 py-3 rounded-xl text-sm ${flsResultat ? "bg-success-soft text-success" : "bg-surface-alt text-tx"}`}>
                      <p className="font-bold">
                        {flsResultat ? "Répartition appliquée" : "Aperçu — rien n'est encore modifié"}
                      </p>
                      <p className="mt-1">
                        {r.lignes_fichier} ligne{r.lignes_fichier !== 1 ? "s" : ""} dans le fichier · {r.avec_fls} avec FLS · {r.sans_fls} sans FLS ·{" "}
                        {r.a_modifier} école{r.a_modifier !== 1 ? "s" : ""} {flsResultat ? "modifiée" : "à modifier"}{r.a_modifier !== 1 ? "s" : ""} ·{" "}
                        {r.ief_completees} IEF {flsResultat ? "complétée" : "à compléter"}{r.ief_completees !== 1 ? "s" : ""}
                      </p>
                      {flsResultat && r.ecoles_sans_type_restantes != null && (
                        <p className="mt-1">{r.ecoles_sans_type_restantes} école{r.ecoles_sans_type_restantes !== 1 ? "s" : ""} restent sans type FLS renseigné (elles voient tout l&apos;emploi du temps).</p>
                      )}
                    </div>

                    {r.erreurs.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-danger mb-1">Erreurs du fichier ({r.erreurs.length})</p>
                        <div className="px-3 py-2 rounded-lg bg-danger-soft text-danger text-xs space-y-0.5 max-h-32 overflow-auto">
                          {r.erreurs.map((e, i) => <p key={i}>{e.feuille} · ligne {e.ligne} : {e.erreur}</p>)}
                        </div>
                      </div>
                    )}

                    {r.introuvables.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-warn mb-1">Écoles introuvables ({r.introuvables.length})</p>
                        <p className="text-xs text-tx-muted mb-1.5">
                          Sans choix de votre part, ces écoles ne seront pas mises à jour. Acceptez la suggestion ou choisissez l&apos;école
                          correspondante, puis « Actualiser l&apos;aperçu ». Sinon, corrigez le nom dans Gestion Écoles ou dans le fichier.
                        </p>
                        <div className="rounded-lg border border-border text-xs max-h-72 overflow-auto divide-y divide-border">
                          {r.introuvables.map((x, i) => {
                            const choisi = flsChoix[x.nom_fichier] ?? "";
                            const memeIef = ecolesRef.filter(e => x.ief_fichier && cleIef(e.region) === cleIef(x.ief_fichier));
                            const options = (memeIef.length ? memeIef : ecolesRef).slice().sort((a, b) => a.name.localeCompare(b.name));
                            return (
                              <div key={i} className="px-3 py-2 flex flex-col gap-1.5">
                                <div>
                                  <span className="font-medium text-tx">{x.nom_fichier}</span>
                                  {x.ief_fichier && <span className="text-tx-muted"> · {x.ief_fichier}</span>}
                                  <span className="text-tx-muted"> · {flsLabel(x.fls)}</span>
                                  {x.raison && <span className="block text-danger">{x.raison}</span>}
                                </div>
                                {x.suggestion && x.suggestion_id && (
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={choisi === x.suggestion_id}
                                      onChange={ev => choisirEcole(x.nom_fichier, ev.target.checked ? x.suggestion_id! : null)} />
                                    <span>Utiliser « <strong>{x.suggestion}</strong> »{x.suggestion_ief ? ` (${x.suggestion_ief})` : ""}</span>
                                  </label>
                                )}
                                <select value={choisi} onChange={ev => choisirEcole(x.nom_fichier, ev.target.value || null)}
                                  className="border border-border rounded-lg px-2 py-1 bg-bg text-tx max-w-md">
                                  <option value="">{memeIef.length ? "Choisir une école de cette IEF…" : "Choisir une école…"}</option>
                                  {options.map(e => <option key={e.id} value={e.id}>{e.name}{e.region ? ` — ${e.region}` : ""}</option>)}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {r.ambigues.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-warn mb-1">Écoles ambiguës ({r.ambigues.length})</p>
                        <p className="text-xs text-tx-muted mb-1.5">Plusieurs écoles correspondent : choisissez la bonne, sinon elles ne seront pas mises à jour.</p>
                        <div className="rounded-lg border border-border text-xs max-h-40 overflow-auto divide-y divide-border">
                          {r.ambigues.map((x, i) => (
                            <div key={i} className="px-3 py-1.5">
                              <span className="font-medium text-tx">{x.nom_fichier}</span>
                              {x.ief_fichier && <span className="text-tx-muted"> · IEF {x.ief_fichier}</span>}
                              <span className="text-tx-muted"> · {flsLabel(x.fls)}</span>
                              {x.raison && <span className="block text-tx-muted">{x.raison}</span>}
                              <select value={flsChoix[x.nom_fichier] ?? ""} onChange={ev => choisirEcole(x.nom_fichier, ev.target.value || null)}
                                className="mt-1 border border-border rounded-lg px-2 py-1 bg-bg text-tx max-w-md">
                                <option value="">Choisir la bonne école…</option>
                                {x.ecoles.map(ec => <option key={ec.id} value={ec.id}>{ec.nom}{ec.ief ? ` — ${ec.ief}` : ""}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {r.trouvees.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-tx mb-1">Écoles trouvées ({r.trouvees.length})</p>
                        <div className="rounded-lg border border-border max-h-64 overflow-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-surface-alt sticky top-0">
                              <tr className="text-tx-muted">
                                {["Nom dans le fichier", "École en base", "FLS avant → après", "IEF"].map(h => (
                                  <th key={h} className="text-left px-3 py-1.5 font-semibold">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {r.trouvees.map((x, i) => (
                                <tr key={i} className={`border-t border-border ${x.change ? "" : "text-tx-muted"}`}>
                                  <td className="px-3 py-1.5">{x.nom_fichier}</td>
                                  <td className="px-3 py-1.5">{x.nom}</td>
                                  <td className="px-3 py-1.5 whitespace-nowrap">
                                    {flsLabel(x.fls_actuel)} → <span className={x.change ? "font-semibold text-brand" : ""}>{flsLabel(x.fls)}</span>
                                  </td>
                                  <td className="px-3 py-1.5">
                                    {x.ief ?? "—"}
                                    {x.ief_differente && (
                                      <span className="block text-warn">⚠ IEF du fichier différente : {x.ief_fichier ?? "—"}</span>
                                    )}
                                    {x.ief_manquante && x.ief_fichier && (
                                      <span className="block text-tx-muted">{flsCompleterIef ? "IEF complétée" : "IEF manquante"} : {x.ief_fichier}</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-border mt-3">
                <button
                  onClick={() => { setShowFlsImport(false); resetFlsImport(); }}
                  className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">
                  {flsResultat ? "Fermer" : "Annuler"}
                </button>
                {flsResultat ? (
                  <button
                    onClick={() => resetFlsImport()}
                    className="px-4 py-2 rounded-xl border border-border text-sm text-tx hover:bg-surface-alt transition-colors">
                    Importer un autre fichier
                  </button>
                ) : (
                  <button
                    onClick={handleFlsImport}
                    disabled={!flsFile || flsBusy}
                    className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {flsBusy ? "Traitement…"
                      : flsApercu && flsChoixModifies ? "Actualiser l'aperçu avec mes choix"
                      : flsApercu ? `Appliquer (${flsApercu.a_modifier} école${flsApercu.a_modifier !== 1 ? "s" : ""} à modifier)`
                      : "Analyser le fichier"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
