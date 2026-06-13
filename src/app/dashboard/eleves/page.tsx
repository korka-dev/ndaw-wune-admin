"use client";
import { useEffect, useRef, useState } from "react";
import { elevesApi, schoolsApi, sessionsApi } from "@/lib/api";
import { downloadBlob } from "@/lib/csv";
import Pagination from "@/components/Pagination";
import ExportModal from "@/components/ExportModal";

const PAGE_SIZE = 50;

const ELEVE_EXPORT_FIELDS = [
  { key: "nom",     label: "Nom" },
  { key: "prenom",  label: "Prénom" },
  { key: "sexe",    label: "Sexe" },
  { key: "naiss",   label: "Date de naissance" },
  { key: "classe",  label: "Classe" },
  { key: "statut",  label: "Statut" },
];

interface Eleve {
  id: string;
  nom: string;
  prenom?: string;
  genre?: string;
  date_naissance?: string;
  classe?: string;
  school_id?: string;
  session_id?: string;
  statut: string;
  school_name?: string;
  school_region?: string;
}
interface School { id: string; name: string; }
interface Session { id: string; name: string; status: string; }

const NIVEAU_CLASSES: Record<string, string[]> = {
  "CP": ["CP A", "CP B", "CP C"],
  "CE": ["CE1 A", "CE1 B", "CE1 C", "CE1 D", "CE2 A", "CE2 B", "CE2 C", "CE2 D"],
  "CM": ["CM1 A", "CM1 B", "CM1 C", "CM1 D", "CM2 A", "CM2 B", "CM2 C", "CM2 D"],
};
const NIVEAUX = Object.keys(NIVEAU_CLASSES);
const ELEVE_CLASSES = Object.values(NIVEAU_CLASSES).flat();

function getInitialNiveau(classe: string): string {
  for (const [niv, classes] of Object.entries(NIVEAU_CLASSES)) {
    if (classes.includes(classe)) return niv;
  }
  return "";
}

const EMPTY_FORM = {
  nom: "", prenom: "", genre: "", date_naissance: "", classe: "", school_id: "", session_id: "",
};

type FormType = typeof EMPTY_FORM;

type ModalState =
  | null
  | "create"
  | { kind: "view"; eleve: Eleve }
  | { kind: "edit"; eleve: Eleve }
  | { kind: "delete"; eleve: Eleve }
  | { kind: "bulkDelete"; count: number };

function cleanNamePart(text: string | undefined | null): string {
  if (!text) return "";
  let cleaned = text.replace(/\b(N[oO°•*]?\s*\d+|NUMERO|\d+)\b/gi, "");
  cleaned = cleaned.replace(/([A-Za-zÀ-ÿ]+)\d+/gi, "$1");
  cleaned = cleaned.replace(/\b(N[*•°]?)\b/gi, "");
  return cleaned.replace(/\s+/g, " ").trim();
}

// ── FormFields défini EN DEHORS du composant pour éviter le bug de curseur ──
function EleveFormFields({
  form, setForm, schools, sessions,
}: {
  form: FormType;
  setForm: React.Dispatch<React.SetStateAction<FormType>>;
  schools: School[];
  sessions: Session[];
}) {
  const [niveau, setNiveau] = useState<string>(() => getInitialNiveau(form.classe));

  const classesForNiveau = niveau ? (NIVEAU_CLASSES[niveau] ?? []) : [];

  const handleNiveauChange = (n: string) => {
    setNiveau(n);
    setForm(f => ({ ...f, classe: "" }));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-tx mb-1">Nom <span className="text-danger">*</span></label>
          <input
            type="text" value={form.nom}
            onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
            placeholder="Diallo"
            className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-tx mb-1">Prénom</label>
          <input
            type="text" value={form.prenom}
            onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
            placeholder="Amadou"
            className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-tx mb-1">Sexe</label>
          <select
            value={form.genre}
            onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
            className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition"
          >
            <option value="">— Sélectionner —</option>
            <option value="Garçon">Garçon</option>
            <option value="Fille">Fille</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-tx mb-1">Date de naissance</label>
          <input
            type="date" value={form.date_naissance}
            onChange={e => setForm(f => ({ ...f, date_naissance: e.target.value }))}
            className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition"
          />
        </div>
      </div>

      {/* ── Cascade Niveau → Classe ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Niveau */}
        <div>
          <label className="block text-sm font-medium text-tx mb-1">Niveau <span className="text-danger">*</span></label>
          <div className="relative">
            <select
              value={niveau}
              onChange={e => handleNiveauChange(e.target.value)}
              className="w-full bg-surface-alt border border-border rounded-xl px-3.5 pr-9 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none cursor-pointer"
            >
              <option value="">— Niveau —</option>
              {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>

        {/* Classe — désactivée tant que niveau non choisi */}
        <div>
          <label className="block text-sm font-medium text-tx mb-1">Classe <span className="text-danger">*</span></label>
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
            <select
              value={form.classe}
              onChange={e => setForm(f => ({ ...f, classe: e.target.value }))}
              disabled={!niveau}
              className="w-full bg-surface-alt border border-border rounded-xl pl-9 pr-9 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{niveau ? "— Classe —" : "— Choisir un niveau d'abord —"}</option>
              {classesForNiveau.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-tx mb-1">École</label>
        <select
          value={form.school_id}
          onChange={e => setForm(f => ({ ...f, school_id: e.target.value }))}
          className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition"
        >
          <option value="">— Sélectionner —</option>
          {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-tx mb-1">Session</label>
        <select
          value={form.session_id}
          onChange={e => setForm(f => ({ ...f, session_id: e.target.value }))}
          className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition"
        >
          <option value="">— Sélectionner —</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
    </div>
  );
}

export default function ElevesPage() {
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState<FormType>(EMPTY_FORM);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSchool, setFilterSchool] = useState("");
  const [filterClasse, setFilterClasse] = useState("");
  const [filterSession, setFilterSession] = useState("");
  const [filterSexe, setFilterSexe] = useState("");
  const [page, setPage] = useState(1);

  // ── Sélection multiple ────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const load = (isFirstLoad = false) => {
    if (isFirstLoad) { setDataLoading(true); setDataError(null); }
    Promise.all([
      elevesApi.list({ limit: 10000 }),
      schoolsApi.list({ limit: 10000 }),
      sessionsApi.list(),
    ]).then(([er, sr, sesr]) => {
      setEleves(er.data.items ?? []);
      setSchools(sr.data.items ?? []);
      setSessions(sesr.data.items ?? []);
      setDataError(null);
    }).catch(() => {
      setDataError("Impossible de charger les données. Vérifiez votre connexion.");
    }).finally(() => {
      if (isFirstLoad) setDataLoading(false);
    });
  };
  useEffect(() => { load(true); }, []);
  useEffect(() => { setPage(1); }, [search, filterSchool, filterClasse, filterSession, filterSexe]);
  useEffect(() => { setSelectedIds(new Set()); setSelectAll(false); }, [search, filterSchool, filterClasse, filterSession, filterSexe]);

  const hasFilters = !!(search || filterSchool || filterClasse || filterSession || filterSexe);

  const filtered = eleves.filter(e => {
    const cleanNom = cleanNamePart(e.nom);
    const cleanPrenom = cleanNamePart(e.prenom);
    const fName = `${cleanNom} ${cleanPrenom}`.toLowerCase();
    const matchSearch = !search.trim() || fName.includes(search.toLowerCase());
    const matchSchool = !filterSchool || e.school_id === filterSchool;
    const matchClasse = !filterClasse || e.classe === filterClasse;
    const matchSession = !filterSession || e.session_id === filterSession;
    const matchSexe = !filterSexe || e.genre === filterSexe;
    return matchSearch && matchSchool && matchClasse && matchSession && matchSexe;
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Helpers de sélection ──────────────────────────────────────────────────
  const pageIds = paginated.map(e => e.id);
  const allPageSel = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
  const somePageSel = pageIds.some(id => selectedIds.has(id));
  const selCount = selectAll ? filtered.length : selectedIds.size;

  const toggleOne = (id: string) => {
    setSelectAll(false);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const togglePage = () => {
    setSelectAll(false);
    if (allPageSel) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const selectAllFiltered = () => {
    setSelectAll(true);
    setSelectedIds(new Set(filtered.map(e => e.id)));
  };

  const clearSelection = () => {
    setSelectAll(false);
    setSelectedIds(new Set());
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const openCreate = () => { setForm(EMPTY_FORM); setSaveError(null); setModal("create"); };
  const openEdit = (eleve: Eleve) => {
    setForm({
      nom: cleanNamePart(eleve.nom) || (eleve.nom ?? ""),
      prenom: cleanNamePart(eleve.prenom) || (eleve.prenom ?? ""),
      genre: eleve.genre ?? "",
      date_naissance: eleve.date_naissance ?? "",
      classe: eleve.classe ?? "",
      school_id: eleve.school_id ?? "",
      session_id: eleve.session_id ?? "",
    });
    setSaveError(null);
    setModal({ kind: "edit", eleve });
  };

  const save = async () => {
    if (!form.nom.trim()) { setSaveError("Le nom est requis."); return; }
    if (!form.classe) { setSaveError("La classe est requise."); return; }
    setSaveError(null);
    setLoading(true);
    try {
      if (modal === "create") {
        await elevesApi.create(form);
      } else if (modal && typeof modal === "object" && modal.kind === "edit") {
        await elevesApi.update(modal.eleve.id, form);
      }
      load(false);
      setModal(null);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        setSaveError(detail.map((d: any) => d.msg).join(", "));
      } else {
        setSaveError(detail ?? "Une erreur est survenue.");
      }
    } finally {
      setLoading(false);
    }
  };

  const doDelete = async (eleve: Eleve) => {
    setLoading(true);
    try { await elevesApi.delete(eleve.id); load(false); setModal(null); }
    finally { setLoading(false); }
  };

  const doBulkDelete = async () => {
    setLoading(true);
    try {
      const ids = selectAll ? filtered.map(e => e.id) : Array.from(selectedIds);
      await elevesApi.bulkDelete(ids);
      clearSelection();
      load(false);
      setModal(null);
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExportXlsx = async (fields: string[]) => {
    setExporting(true);
    try {
      const res = await elevesApi.exportXlsx(fields.join(","));
      downloadBlob(res.data, "eleves.xlsx");
      setShowExportModal(false);
    } catch { /* silencieux */ }
    finally { setExporting(false); }
  };

  const schoolName = (id?: string) => schools.find(s => s.id === id)?.name ?? "—";
  const sessionName = (id?: string) => sessions.find(s => s.id === id)?.name ?? "—";
  const fullName = (e: Eleve) => {
    const cNom = cleanNamePart(e.nom);
    const cPrenom = cleanNamePart(e.prenom);
    return [cNom, cPrenom].filter(Boolean).join(" ");
  };
  const initials = (e: Eleve) => {
    const cNom = cleanNamePart(e.nom);
    const cPrenom = cleanNamePart(e.prenom);
    return [cNom?.[0], cPrenom?.[0]].filter(Boolean).join("").toUpperCase() || "?";
  };

  return (
    <div className="flex flex-col h-full px-7 pb-7">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Gestion Élèves</h1>
          <p className="text-tx-muted text-sm mt-0.5">
            {hasFilters
              ? `${filtered.length} résultat${filtered.length !== 1 ? "s" : ""} sur ${eleves.length} élève${eleves.length !== 1 ? "s" : ""}`
              : `${eleves.length} élève${eleves.length !== 1 ? "s" : ""} au total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExportModal(true)}
            disabled={exporting}
            className="flex items-center gap-2 border border-border bg-surface text-tx px-3.5 py-2.5 rounded-xl text-sm font-semibold hover:bg-surface-alt transition-colors disabled:opacity-60"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            {exporting ? "Export…" : "Exporter Excel"}
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Ajouter
          </button>
        </div>
      </div>

      {/* ── Filtres ── */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou prénom…"
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tx-muted hover:text-tx">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        <div className="relative">
          <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)}
            className={`pl-4 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 transition appearance-none min-w-[160px] ${filterSchool ? "border-brand text-brand font-medium" : "border-border text-tx"}`}>
            <option value="">Toutes les écoles</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none"><path d="M6 9l6 6 6-6" /></svg>
        </div>

        <div className="relative">
          <select value={filterClasse} onChange={e => setFilterClasse(e.target.value)}
            className={`pl-4 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 transition appearance-none min-w-[130px] ${filterClasse ? "border-brand text-brand font-medium" : "border-border text-tx"}`}>
            <option value="">Toutes les classes</option>
            {ELEVE_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none"><path d="M6 9l6 6 6-6" /></svg>
        </div>

        <div className="relative">
          <select value={filterSession} onChange={e => setFilterSession(e.target.value)}
            className={`pl-4 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 transition appearance-none min-w-[150px] ${filterSession ? "border-brand text-brand font-medium" : "border-border text-tx"}`}>
            <option value="">Toutes les sessions</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none"><path d="M6 9l6 6 6-6" /></svg>
        </div>

        <div className="relative">
          <select value={filterSexe} onChange={e => setFilterSexe(e.target.value)}
            className={`pl-4 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 transition appearance-none min-w-[120px] ${filterSexe ? "border-brand text-brand font-medium" : "border-border text-tx"}`}>
            <option value="">Tous les sexes</option>
            <option value="Garçon">Garçon</option>
            <option value="Fille">Fille</option>
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none"><path d="M6 9l6 6 6-6" /></svg>
        </div>

        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setFilterSchool(""); setFilterClasse(""); setFilterSession(""); setFilterSexe(""); }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-brand/30 bg-brand-soft text-brand text-sm font-medium hover:bg-brand hover:text-white transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            Réinitialiser
          </button>
        )}
      </div>

      {/* ── Barre de sélection multiple ── */}
      {selCount > 0 && (
        <div className="mb-3 flex items-center gap-3 px-4 py-2.5 bg-brand/8 border border-brand/20 rounded-xl">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-brand text-white text-[11px] font-bold">
              {selCount}
            </span>
            <span className="text-sm font-medium text-brand">
              {selCount} élève{selCount > 1 ? "s" : ""} sélectionné{selCount > 1 ? "s" : ""}
            </span>
            {!selectAll && selCount < filtered.length && (
              <button onClick={selectAllFiltered} className="text-xs text-brand/70 hover:text-brand underline transition-colors ml-1">
                Sélectionner les {filtered.length} résultats
              </button>
            )}
          </div>
          <button
            onClick={() => setModal({ kind: "bulkDelete", count: selCount })}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-danger text-white text-xs font-semibold hover:bg-danger/90 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
            </svg>
            Supprimer la sélection
          </button>
          <button onClick={clearSelection} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-brand/10 text-brand/60 hover:text-brand transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* ── Erreur chargement ── */}
      {dataError && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-danger-soft border border-danger/20 rounded-xl text-sm text-danger">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <span>{dataError}</span>
          <button onClick={() => load(true)} className="ml-auto text-xs underline font-medium">Réessayer</button>
        </div>
      )}

      {/* ── Tableau ── */}
      <div className="bg-surface rounded-2xl border border-border flex-1 min-h-0 flex flex-col overflow-hidden">
        {dataLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
            <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity=".2" />
              <path d="M12 2a10 10 0 0110 10" stroke="currentColor" />
            </svg>
            <span className="text-sm text-tx-muted">Chargement des élèves…</span>
          </div>
        )}

        <div className={`overflow-x-auto overflow-y-auto flex-1 ${dataLoading ? "hidden" : ""}`}>
          <table className="w-full text-sm table-fixed min-w-[1050px]">
            <colgroup><col className="w-[44px]" /><col className="w-[20%]" /><col className="w-[8%]" /><col className="w-[20%]" /><col className="w-[16%]" /><col className="w-[10%]" /><col className="w-[20%]" /></colgroup>
            <thead className="sticky top-0 z-10 bg-surface-alt shadow-sm">
              <tr className="border-b border-border bg-surface-alt">
                <th className="px-3 py-3 text-center bg-surface-alt sticky top-0 z-10">
                  <button
                    onClick={togglePage}
                    className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center mx-auto transition-colors ${allPageSel ? "bg-brand border-brand" : somePageSel ? "bg-brand/30 border-brand" : "border-border hover:border-brand/50"}`}
                    title={allPageSel ? "Tout désélectionner" : "Sélectionner la page"}
                  >
                    {allPageSel && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                    {somePageSel && !allPageSel && <span className="w-2 h-0.5 bg-brand rounded-full block" />}
                  </button>
                </th>
                {["Nom / Prénom", "Classe", "École", "IEF", "Statut", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-tx-muted uppercase tracking-wide first:text-center bg-surface-alt sticky top-0 z-10">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(e => {
                const isSel = selectedIds.has(e.id);
                const ecole = e.school_name ?? schoolName(e.school_id);
                const ief = e.school_region ?? "—";
                return (
                  <tr key={e.id} className={`border-t border-border transition-colors ${isSel ? "bg-brand/5" : "hover:bg-surface-alt"}`}>
                    <td className="px-3 py-3.5 text-center" onClick={ev => ev.stopPropagation()}>
                      <button
                        onClick={() => toggleOne(e.id)}
                        className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center mx-auto transition-colors ${isSel ? "bg-brand border-brand" : "border-border hover:border-brand/50"}`}
                      >
                        {isSel && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 cursor-pointer" onClick={() => setModal({ kind: "view", eleve: e })}>
                      <div className="min-w-0">
                        <div className="font-semibold text-tx truncate">{cleanNamePart(e.nom) || cleanNamePart(e.prenom) || "—"}</div>
                        {cleanNamePart(e.nom) && cleanNamePart(e.prenom) && (
                          <div className="text-xs text-tx-muted truncate">{cleanNamePart(e.prenom)}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 cursor-pointer" onClick={() => setModal({ kind: "view", eleve: e })}>
                      {e.classe ? <span className="bg-primary-soft text-primary text-xs font-bold px-2 py-0.5 rounded-md">{e.classe}</span> : <span className="text-tx-muted">—</span>}
                    </td>
                    <td className="px-4 py-3.5 cursor-pointer" onClick={() => setModal({ kind: "view", eleve: e })}>
                      <span className="text-sm text-tx truncate block" title={ecole}>{ecole}</span>
                    </td>
                    <td className="px-4 py-3.5 cursor-pointer" onClick={() => setModal({ kind: "view", eleve: e })}>
                      {ief !== "—"
                        ? <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-warn-soft text-warn">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-5 9 5-9 5-9-5z" /><path d="M5 10v6c0 2 3 4 7 4s7-2 7-4v-6" /></svg>
                            {ief}
                          </span>
                        : <span className="text-tx-muted text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3.5 cursor-pointer" onClick={() => setModal({ kind: "view", eleve: e })}>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${e.statut === "actif" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${e.statut === "actif" ? "bg-success" : "bg-danger"}`} />
                        {e.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3.5" onClick={ev => ev.stopPropagation()}>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(e)} className="text-xs bg-primary-soft text-primary px-3 py-1 rounded-lg font-medium hover:bg-primary hover:text-white transition-colors">Modifier</button>
                        <button onClick={() => setModal({ kind: "delete", eleve: e })} className="text-xs bg-danger-soft text-danger px-3 py-1 rounded-lg font-medium hover:bg-danger hover:text-white transition-colors">Supprimer</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-tx-muted text-sm">
                  {hasFilters ? "Aucun élève ne correspond aux filtres." : "Aucun élève pour l'instant."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {!dataLoading && (
          <div className="px-5 flex-shrink-0">
            <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
          </div>
        )}
      </div>

      {/* ── Modal Vue détail ── */}
      {modal && typeof modal === "object" && modal.kind === "view" && (() => {
        const e = modal.eleve;
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
            onClick={ev => { if (ev.target === ev.currentTarget) setModal(null); }}>
            <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="bg-primary-soft rounded-t-2xl px-6 pt-6 pb-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-lg font-bold flex-shrink-0">{initials(e)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-tx text-base truncate">{fullName(e)}</div>
                  {e.classe && <div className="text-xs text-tx-muted mt-0.5">Classe : {e.classe}</div>}
                  <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${e.statut === "actif" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${e.statut === "actif" ? "bg-success" : "bg-danger"}`} />
                    {e.statut}
                  </span>
                </div>
              </div>
              <div className="px-6 py-4 space-y-3">
                {[
                  { label: "Sexe", value: e.genre ?? "—" },
                  { label: "Date de naissance", value: e.date_naissance ? new Date(e.date_naissance).toLocaleDateString("fr-FR") : "—" },
                  { label: "École", value: e.school_name ?? schoolName(e.school_id) },
                  { label: "IEF", value: e.school_region ?? "—" },
                  { label: "Session", value: sessionName(e.session_id) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-tx-muted">{label}</span>
                    <span className="font-medium text-tx">{value}</span>
                  </div>
                ))}
              </div>
              <div className="px-6 pb-5 flex gap-3">
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors">Fermer</button>
                <button onClick={() => openEdit(e)} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">Modifier</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal Créer / Modifier ── */}
      {(modal === "create" || (modal && typeof modal === "object" && modal.kind === "edit")) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
          onClick={ev => { if (ev.target === ev.currentTarget) setModal(null); }}>
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-tx mb-5">
              {modal === "create" ? "Nouvel élève" : "Modifier l'élève"}
            </h2>
            <EleveFormFields form={form} setForm={setForm} schools={schools} sessions={sessions} />
            {saveError && (
              <p className="mt-3 text-sm text-danger bg-danger-soft rounded-xl px-3.5 py-2">{saveError}</p>
            )}
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">Annuler</button>
              <button onClick={save} disabled={loading || !form.nom.trim() || !form.classe}
                className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {loading ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Suppression unitaire ── */}
      {modal && typeof modal === "object" && modal.kind === "delete" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-danger-soft flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-tx">Supprimer l&apos;élève</h2>
                <p className="text-sm text-tx-muted mt-1">
                  Êtes-vous sûr de vouloir supprimer <span className="font-semibold text-tx">{fullName(modal.eleve)}</span> ? Cette action est irréversible.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">Annuler</button>
              <button onClick={() => doDelete(modal.eleve)} disabled={loading}
                className="px-4 py-2 rounded-xl bg-danger hover:bg-danger/90 text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {loading ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Suppression multiple ── */}
      {modal && typeof modal === "object" && modal.kind === "bulkDelete" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-danger-soft flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-tx">Supprimer {modal.count} élève{modal.count > 1 ? "s" : ""}</h2>
                <p className="text-sm text-tx-muted mt-1">
                  Cette action va supprimer définitivement <span className="font-semibold text-tx">{modal.count} élève{modal.count > 1 ? "s" : ""}</span> sélectionné{modal.count > 1 ? "s" : ""}. Elle est irréversible.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">Annuler</button>
              <button onClick={doBulkDelete} disabled={loading}
                className="px-4 py-2 rounded-xl bg-danger hover:bg-danger/90 text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {loading ? "Suppression…" : `Supprimer ${modal.count} élève${modal.count > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <ExportModal
          title="Exporter les élèves"
          fields={ELEVE_EXPORT_FIELDS}
          exporting={exporting}
          onClose={() => setShowExportModal(false)}
          onExport={handleExportXlsx}
        />
      )}
    </div>
  );
}
