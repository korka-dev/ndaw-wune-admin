"use client";
import { useEffect, useRef, useState } from "react";
import { superviseursApi, schoolsApi, teachersApi } from "@/lib/api";
import { downloadBlob } from "@/lib/csv";
import Pagination from "@/components/Pagination";
import { Carte, Donut } from "@/components/Charts";

const PAGE_SIZE = 50;

interface SchoolBrief { id: string; name: string; code_ecole?: number; region?: string; }
interface Superviseur {
  id: string; name: string; phone?: string; title?: string;
  status: string; school_id?: string; classes?: string[];
  school?: SchoolBrief;
}
interface School { id: string; name: string; code_ecole?: number; region?: string; }
interface Teacher { id: string; name: string; phone?: string; school_id?: string; classes?: string[]; }

const EMPTY = { name: "", phone: "", title: "", school_id: "", classes: [] as string[] };
type ModalState = null | "create"
  | { kind: "view"; sup: Superviseur }
  | { kind: "manage"; sup: Superviseur }
  | { kind: "toggle"; sup: Superviseur }
  | { kind: "edit"; sup: Superviseur }
  | { kind: "delete"; sup: Superviseur }
  | { kind: "assign"; sup: Superviseur }
  | { kind: "created"; name: string; phone: string };

const cls = "w-full border border-border rounded-xl px-3.5 py-2.5 text-sm bg-bg text-tx outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors";

/* Mot de passe temporaire attribué par le backend à la création d'un compte
   (voir backend/app/core/config.py — DEFAULT_USER_PASSWORD). Le superviseur
   devra le changer dès sa première connexion à l'application mobile. */
const TEMP_PASSWORD = "Passer123";

export default function SuperviseursPage() {
  const [sups, setSups] = useState<Superviseur[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [search, setSearch] = useState("");
  const [filterSchool, setFilterSchool] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  /* état modal assignation */
  const [assignIds, setAssignIds] = useState<string[]>([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  /* auto-focus premier champ à l'ouverture du modal */
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  /* fermer le dropdown export au clic extérieur */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (modal === "create" || (modal && typeof modal === "object" && (modal.kind === "edit"))) {
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    }
  }, [modal]);

  const load = (isFirstLoad = false) => {
    if (isFirstLoad) { setDataLoading(true); setDataError(null); }
    Promise.all([
      superviseursApi.list({ limit: 10000 }),
      schoolsApi.list({ limit: 10000 }),
      teachersApi.list({ limit: 10000 }),
    ])
      .then(([rSups, rSchools, rTeachers]) => {
        setSups(rSups.data.items ?? []);
        setSchools(rSchools.data.items ?? []);
        setTeachers(rTeachers.data.items ?? []);
        setDataError(null);
      })
      .catch(() => { setDataError("Impossible de charger les données."); })
      .finally(() => { if (isFirstLoad) setDataLoading(false); });
  };
  useEffect(() => { load(true); }, []);

  const handleExport = async (fmt: "csv" | "xlsx") => {
    setExporting(fmt);
    try {
      const res = fmt === "csv"
        ? await superviseursApi.exportCsv()
        : await superviseursApi.exportXlsx();
      downloadBlob(res.data, fmt === "csv" ? "superviseurs.csv" : "superviseurs.xlsx");
    } catch { /* silencieux */ }
    finally { setExporting(null); }
  };

  /* Vérification unicité téléphone : superviseurs + enseignants */
  const checkPhone = (phone: string, excludeId?: string) => {
    const t = phone.trim();
    if (!t) { setPhoneError(""); return; }
    const dupSup = sups.find(s => s.phone?.trim() === t && s.id !== excludeId);
    const dupTeacher = teachers.find(x => x.phone?.trim() === t);
    const dup = dupSup ?? dupTeacher;
    setPhoneError(dup ? `Ce numéro est déjà utilisé par « ${dup.name} ».` : "");
  };

  const save = async () => {
    if (!form.name.trim() || phoneError) return;
    setLoading(true);
    try {
      if (modal === "create") {
        await superviseursApi.create({ ...form, role: "coordonnateur" });
        load(false);
        setModal({ kind: "created", name: form.name.trim(), phone: form.phone.trim() });
      } else if (modal && typeof modal === "object" && modal.kind === "edit") {
        await superviseursApi.update(modal.sup.id, form);
        load(false); setModal(null);
      }
    } finally { setLoading(false); }
  };

  const doDelete = async (sup: Superviseur) => {
    setLoading(true);
    try { await superviseursApi.delete(sup.id); load(false); setModal(null); }
    finally { setLoading(false); }
  };

  const doToggle = async (sup: Superviseur) => {
    setLoading(true);
    try { await superviseursApi.toggleStatus(sup.id); load(false); closeModal(); }
    finally { setLoading(false); }
  };

  const toggleTeacher = (id: string) =>
    setForm(f => ({
      ...f,
      classes: f.classes.includes(id)
        ? f.classes.filter(x => x !== id)
        : [...f.classes, id],
    }));

  /* Naviguer au champ suivant avec Entrée */
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, nextId?: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (nextId) (document.getElementById(nextId) as HTMLElement | null)?.focus();
      else save();
    }
  };

  const initials = (n: string) => n.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  const getSchool = (sup: Superviseur) => sup.school ?? schools.find(s => s.id === sup.school_id);
  const schoolName = (sup: Superviseur) => {
    const s = getSchool(sup);
    if (!s) return "—";
    return s.code_ecole != null ? `[${s.code_ecole}] ${s.name}` : s.name;
  };
  const schoolNameById = (id?: string) => schools.find(s => s.id === id)?.name ?? "—";
  const schoolTeachers = (sid: string) => teachers.filter(t => t.school_id === sid);
  const assignedTeachers = (ids?: string[]) => teachers.filter(t => ids?.includes(t.id));

  /* Réinitialiser la page quand les filtres changent */
  useEffect(() => { setPage(1); }, [search, filterSchool, filterStatus]);

  const hasFilters = !!(search || filterSchool || filterStatus);
  const filtered = sups.filter(s => {
    const matchSearch = !search.trim() ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      schoolName(s).toLowerCase().includes(search.toLowerCase());
    const matchSchool = !filterSchool || s.school_id === filterSchool;
    const matchStatus = !filterStatus || s.status === filterStatus;
    return matchSearch && matchSchool && matchStatus;
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => { setForm(EMPTY); setPhoneError(""); setModal("create"); };
  const openEdit = (sup: Superviseur) => {
    setForm({
      name: sup.name, phone: sup.phone ?? "", title: sup.title ?? "",
      school_id: sup.school_id ?? "", classes: sup.classes ?? []
    });
    setPhoneError("");
    setModal({ kind: "edit", sup });
  };
  const openAssign = (sup: Superviseur) => {
    setAssignIds(sup.classes ?? []);
    setAssignSearch("");
    setModal({ kind: "assign", sup });
  };
  const toggleAssignId = (id: string) =>
    setAssignIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const saveAssign = async (sup: Superviseur) => {
    setLoading(true);
    try { await superviseursApi.assignTeachers(sup.id, assignIds); load(false); closeModal(); }
    finally { setLoading(false); }
  };
  const closeModal = () => setModal(null);

  const isFormOpen = modal === "create" || (modal !== null && typeof modal === "object" && (modal as any).kind === "edit");
  const formTitle = modal === "create" ? "Nouveau superviseur" : "Modifier le superviseur";
  const managedSup = modal && typeof modal === "object" && (modal as any).kind === "manage" ? (modal as any).sup as Superviseur : null;

  return (
    <div className="flex flex-col min-h-full px-7 pb-7">

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Gestion Superviseurs</h1>
          <p className="text-tx-muted text-sm mt-0.5">
            {hasFilters
              ? `${filtered.length} résultat${filtered.length !== 1 ? "s" : ""} sur ${sups.length} superviseur${sups.length !== 1 ? "s" : ""}`
              : `${sups.length} superviseur${sups.length !== 1 ? "s" : ""} au total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export — bouton unique avec dropdown */}
          <div ref={exportRef} className="relative">
            <button
              onClick={() => setExportOpen(o => !o)}
              disabled={!!exporting}
              className="flex items-center gap-2 bg-surface border border-border hover:bg-surface-alt text-tx px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
              {exporting ? (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0110 10"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              )}
              {exporting ? "Export…" : "Exporter"}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                className={`transition-transform duration-150 ${exportOpen ? "rotate-180" : ""}`}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            {exportOpen && (
              <div className="absolute right-0 top-full mt-1.5 bg-surface border border-border rounded-xl shadow-lg overflow-hidden z-20 min-w-[160px]">
                <button
                  onClick={() => { setExportOpen(false); handleExport("csv"); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-tx hover:bg-surface-alt transition-colors text-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-tx-muted">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                  </svg>
                  CSV (.csv)
                </button>
                <div className="border-t border-border"/>
                <button
                  onClick={() => { setExportOpen(false); handleExport("xlsx"); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-tx hover:bg-surface-alt transition-colors text-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    <polyline points="8 13 10.5 17 13 13"/><line x1="10.5" y1="17" x2="10.5" y2="10"/>
                  </svg>
                  Excel (.xlsx)
                </button>
              </div>
            )}
          </div>
          {/* Ajouter */}
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Ajouter
          </button>
        </div>
      </div>

      {/* Couverture — combien de superviseurs ont au moins un enseignant
          assigné. C'est un point de vigilance connu du projet (cf. CLAUDE.md
          §2) : le rattachement superviseur → enseignants est saisi à la main
          et souvent absent. */}
      {sups.length > 0 && (
        <div className="mb-5 max-w-xs">
          <Carte titre="Couverture des superviseurs">
            <Donut
              color="#2F7D4A"
              pct={Math.round(
                (sups.filter(s => (s.classes ?? []).length > 0).length / sups.length) * 100
              )}
              legende={`${sups.filter(s => (s.classes ?? []).length > 0).length} avec enseignant(s) sur ${sups.length}`}
            />
          </Carte>
        </div>
      )}

      {/* ── Barre de recherche + filtres ── */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un superviseur…"
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tx-muted hover:text-tx">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <path d="M3 9l9-5 9 5-9 5-9-5z" /><path d="M5 10v6c0 2 3 4 7 4s7-2 7-4v-6" />
          </svg>
          <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)}
            className={`pl-8 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none min-w-[170px] ${filterSchool ? "border-brand text-brand font-medium" : "border-border text-tx"}`}>
            <option value="">Toutes les écoles</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none"><path d="M6 9l6 6 6-6" /></svg>
        </div>

        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
          </svg>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className={`pl-8 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none min-w-[140px] ${filterStatus ? "border-brand text-brand font-medium" : "border-border text-tx"}`}>
            <option value="">Tous les statuts</option>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none"><path d="M6 9l6 6 6-6" /></svg>
        </div>

        {hasFilters && (
          <button onClick={() => { setSearch(""); setFilterSchool(""); setFilterStatus(""); }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-brand/30 bg-brand-soft text-brand text-sm font-medium hover:bg-brand hover:text-white transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            Réinitialiser
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1">
        <table className="w-full text-sm table-fixed min-w-[800px]">
          <colgroup><col className="w-[24%]" /><col className="w-[14%]" /><col className="w-[30%]" /><col className="w-[13%]" /><col className="w-[10%]" /><col className="w-[9%]" /></colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-surface-alt">
              <th className="px-4 py-3 text-left text-xs font-semibold text-tx-muted uppercase tracking-wide bg-surface-alt sticky top-0">Superviseur</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-tx-muted uppercase tracking-wide bg-surface-alt sticky top-0">Téléphone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-tx-muted uppercase tracking-wide bg-surface-alt sticky top-0">École</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-tx-muted uppercase tracking-wide bg-surface-alt sticky top-0">Enseignants</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-tx-muted uppercase tracking-wide bg-surface-alt sticky top-0">Statut</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-tx-muted uppercase tracking-wide bg-surface-alt sticky top-0">Actions</th>
            </tr>
          </thead>
          <tbody>
            {dataLoading && (
              <tr><td colSpan={6} className="px-5 py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity=".2" /><path d="M12 2a10 10 0 0110 10" />
                  </svg>
                  <span className="text-sm text-tx-muted">Chargement…</span>
                </div>
              </td></tr>
            )}
            {!dataLoading && dataError && (
              <tr><td colSpan={6} className="px-5 py-12 text-center">
                <p className="text-sm text-danger">{dataError}</p>
                <button onClick={() => load(true)} className="mt-2 text-xs text-brand underline">Réessayer</button>
              </td></tr>
            )}
            {!dataLoading && !dataError && paginated.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-tx-muted text-sm">
                {hasFilters ? "Aucun superviseur ne correspond aux filtres." : "Aucun superviseur pour l'instant."}
              </td></tr>
            )}
            {!dataLoading && !dataError && paginated.map(sup => {
              const assigned = assignedTeachers(sup.classes);
              /* Utilise l'école embarquée si disponible, sinon fallback lookup */
              const school = sup.school ?? schools.find(s => s.id === sup.school_id);
              const nbProfs = assigned.length;
              return (
                <tr key={sup.id} onClick={() => setModal({ kind: "view", sup })}
                  className="border-t border-border hover:bg-surface-alt transition-colors cursor-pointer">

                  {/* Superviseur */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-brand-soft text-brand flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {initials(sup.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-tx text-sm leading-tight truncate">{sup.name}</div>
                      </div>
                    </div>
                  </td>

                  {/* Téléphone */}
                  <td className="px-4 py-3">
                    {sup.phone
                      ? <span className="text-sm text-tx font-mono">{sup.phone}</span>
                      : <span className="text-xs text-tx-muted/50 italic">—</span>
                    }
                  </td>

                  {/* École */}
                  <td className="px-4 py-3">
                    {school ? (
                      <div className="min-w-0">
                        <div className="text-sm text-tx font-medium truncate leading-tight">{school.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {school.code_ecole != null && (
                            <span className="text-[10px] font-mono font-semibold text-brand bg-brand-soft px-1.5 py-0.5 rounded">
                              #{school.code_ecole}
                            </span>
                          )}
                          {school.region && (
                            <span className="text-[10px] text-tx-muted">{school.region}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-tx-muted/60 italic">Non assignée</span>
                    )}
                  </td>

                  {/* Enseignants */}
                  <td className="px-4 py-3 text-center">
                    {nbProfs > 0 ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-base font-bold text-tx leading-none">{nbProfs}</span>
                        <span className="text-[10px] text-tx-muted">enseignant{nbProfs > 1 ? "s" : ""}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-tx-muted/60 italic">—</span>
                    )}
                  </td>

                  {/* Statut */}
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${sup.status === "actif" ? "bg-success-soft text-success" : "bg-surface-alt text-tx-muted"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sup.status === "actif" ? "bg-success" : "bg-tx-muted"}`} />
                      {sup.status === "actif" ? "Actif" : "Inactif"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setModal({ kind: "manage", sup })}
                      className="text-xs bg-primary-soft text-primary px-3 py-1.5 rounded-lg font-medium hover:bg-primary hover:text-white transition-colors">
                      Gérer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <div className="pb-4 px-5 border-t border-border">
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      {/* ── Modal Gérer ── */}
      {modal && typeof modal === "object" && modal.kind === "manage" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">

            {/* Avatar + nom */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-full bg-brand-soft text-brand flex items-center justify-center text-sm font-bold flex-shrink-0">
                {initials(modal.sup.name)}
              </div>
              <div>
                <div className="font-semibold text-tx">{modal.sup.name}</div>
                <div className="text-xs text-tx-muted mt-0.5 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${modal.sup.status === "actif" ? "bg-success" : "bg-tx-muted"}`} />
                  {modal.sup.status === "actif" ? "Actif" : "Inactif"}
                  {modal.sup.school_id && (
                    <><span className="text-border">·</span>{schoolName(modal.sup)}</>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              {/* Assigner des enseignants */}
              <button
                onClick={() => openAssign(modal.sup)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-alt hover:bg-brand-soft text-tx hover:text-brand text-sm font-medium transition-colors text-left">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="8" r="3.5" /><path d="M2 21c0-4 3.5-6 7-6s7 2 7 6" />
                  <path d="M19 8v6M16 11h6" />
                </svg>
                Assigner des enseignants
                {(modal.sup.classes ?? []).length > 0 && (
                  <span className="ml-auto text-xs bg-brand text-white font-bold px-2 py-0.5 rounded-full">
                    {(modal.sup.classes ?? []).length}
                  </span>
                )}
              </button>

              {/* Modifier */}
              <button
                onClick={() => { const s = modal.sup; closeModal(); setTimeout(() => openEdit(s), 30); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-alt hover:bg-primary-soft text-tx hover:text-primary text-sm font-medium transition-colors text-left">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Modifier le superviseur
              </button>

              {/* Activer / Désactiver */}
              <button
                onClick={() => setModal({ kind: "toggle", sup: modal.sup })}
                disabled={loading}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left disabled:opacity-60
                  ${modal.sup.status === "actif"
                    ? "bg-surface-alt hover:bg-warn-soft text-tx hover:text-warn"
                    : "bg-surface-alt hover:bg-success-soft text-tx hover:text-success"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18.36 6.64a9 9 0 11-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
                </svg>
                {modal.sup.status === "actif" ? "Désactiver le superviseur" : "Activer le superviseur"}
              </button>

              {/* Supprimer */}
              <button
                onClick={() => { const s = modal.sup; closeModal(); setTimeout(() => setModal({ kind: "delete", sup: s }), 30); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-alt hover:bg-danger-soft text-tx hover:text-danger text-sm font-medium transition-colors text-left">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
                Supprimer le superviseur
              </button>
            </div>

            <button onClick={closeModal}
              className="mt-4 w-full py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ── Modal Création / Édition ── */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

            {/* En-tête */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h2 className="text-base font-bold text-tx">{formTitle}</h2>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-lg text-tx-muted hover:text-tx hover:bg-surface-alt transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            {/* Corps scrollable */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">

              {/* Nom complet */}
              <div>
                <label htmlFor="sv-name" className="text-xs font-semibold text-tx-muted mb-1.5 block">Nom complet *</label>
                <input
                  id="sv-name"
                  ref={firstFieldRef}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => onEnter(e, "sv-phone")}
                  placeholder="Ex : M. Ibou Diallo"
                  className={cls}
                />
              </div>

              {/* Téléphone */}
              <div>
                <label htmlFor="sv-phone" className="text-xs font-semibold text-tx-muted mb-1.5 block">Téléphone</label>
                <input
                  id="sv-phone"
                  type="tel"
                  value={form.phone}
                  onChange={e => {
                    setForm(f => ({ ...f, phone: e.target.value }));
                    const excl = modal && typeof modal === "object" && (modal as any).kind === "edit"
                      ? (modal as any).sup.id : undefined;
                    checkPhone(e.target.value, excl);
                  }}
                  onKeyDown={e => onEnter(e, "sv-school")}
                  placeholder="77 XXX XX XX"
                  className={`${cls} ${phoneError ? "border-danger focus:border-danger focus:ring-danger/20" : ""}`}
                />
                {phoneError && (
                  <p className="mt-1.5 text-xs text-danger flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {phoneError}
                  </p>
                )}
              </div>

              {/* École */}
              <div>
                <label htmlFor="sv-school" className="text-xs font-semibold text-tx-muted mb-1.5 block">École assignée</label>
                <select
                  id="sv-school"
                  value={form.school_id}
                  onChange={e => setForm(f => ({ ...f, school_id: e.target.value, classes: [] }))}
                  onKeyDown={e => onEnter(e as any)}
                  className={cls}
                >
                  <option value="">— Sélectionner une école —</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Sélection enseignants */}
              {form.school_id && (
                <div>
                  <label className="text-xs font-semibold text-tx-muted mb-2 block">
                    Enseignants à superviser{" "}
                    <span className="text-brand font-bold">
                      ({form.classes.length} sélectionné{form.classes.length !== 1 ? "s" : ""})
                    </span>
                  </label>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                    {schoolTeachers(form.school_id).length === 0 ? (
                      <p className="text-sm text-tx-muted italic py-2 text-center">Aucun enseignant dans cette école</p>
                    ) : schoolTeachers(form.school_id).map(t => {
                      const sel = form.classes.includes(t.id);
                      return (
                        <button key={t.id} type="button" onClick={() => toggleTeacher(t.id)}
                          className={`flex items-center gap-3 p-2.5 rounded-xl border-2 text-left transition-all ${sel ? "border-brand bg-brand-soft" : "border-border bg-bg hover:border-brand/40"}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${sel ? "bg-brand text-white" : "bg-surface-alt text-tx-muted"}`}>
                            {initials(t.name)}
                          </div>
                          <div className="flex-1">
                            <div className={`text-sm font-medium ${sel ? "text-brand" : "text-tx"}`}>{t.name}</div>
                            <div className="text-xs text-tx-muted">{(t.classes ?? []).join(", ") || "—"}</div>
                          </div>
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${sel ? "border-brand bg-brand" : "border-border"}`}>
                            {sel && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Pied */}
            <div className="px-6 py-4 border-t border-border flex gap-3 flex-shrink-0">
              <button onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors">
                Annuler
              </button>
              <button onClick={save} disabled={loading || !form.name.trim() || !!phoneError}
                className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {loading ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmation création (mot de passe temporaire) ── */}
      {modal && typeof modal === "object" && modal.kind === "created" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="w-12 h-12 rounded-full bg-success-soft text-success flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <h2 className="text-base font-bold text-tx mb-1">Compte superviseur créé</h2>
            <p className="text-sm text-tx-muted mb-4">
              Communiquez ces identifiants à <strong className="text-tx">{modal.name}</strong> pour sa première connexion sur l'application mobile.
            </p>
            <div className="bg-surface-alt rounded-xl border border-border p-4 space-y-2.5 mb-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-tx-muted">Téléphone</span>
                <span className="text-sm font-medium text-tx">{modal.phone || "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-tx-muted">Mot de passe temporaire</span>
                <span className="text-sm font-mono font-bold text-brand">{TEMP_PASSWORD}</span>
              </div>
            </div>
            <p className="text-xs text-tx-muted mb-5">
              Ce mot de passe est provisoire : l'application demandera au superviseur de le remplacer par un mot de passe personnel dès sa première connexion.
            </p>
            <button onClick={closeModal}
              className="w-full py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity">
              Compris
            </button>
          </div>
        </div>
      )}

      {/* ── Modal Détail ── */}
      {modal && typeof modal === "object" && modal.kind === "view" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

            {/* En-tête coloré */}
            <div className="bg-brand-soft px-6 py-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-brand text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                {initials(modal.sup.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-tx text-base truncate">{modal.sup.name}</div>
                {modal.sup.title && <div className="text-xs text-tx-muted mt-0.5 truncate">{modal.sup.title}</div>}
                <span className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${modal.sup.status === "actif" ? "bg-success-soft text-success" : "bg-surface-alt text-tx-muted"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${modal.sup.status === "actif" ? "bg-success" : "bg-tx-muted"}`} />
                  {modal.sup.status === "actif" ? "Actif" : "Inactif"}
                </span>
              </div>
            </div>

            {/* Infos */}
            <div className="px-6 py-4 space-y-3">

              {/* Téléphone */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-alt flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-tx-muted">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013.09 4.18 2 2 0 015.09 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L9.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                  </svg>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-tx-muted uppercase tracking-wide">Téléphone</div>
                  <div className="text-sm text-tx font-medium">{modal.sup.phone ?? "—"}</div>
                </div>
              </div>

              {/* École */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-alt flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-tx-muted">
                    <path d="M3 9l9-5 9 5-9 5-9-5z" /><path d="M5 10v6c0 2 3 4 7 4s7-2 7-4v-6" />
                  </svg>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-tx-muted uppercase tracking-wide">École</div>
                  <div className="text-sm text-tx font-medium">{schoolName(modal.sup)}</div>
                </div>
              </div>

              {/* Enseignants supervisés */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-alt flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-tx-muted">
                    <circle cx="9" cy="8" r="3.5" /><path d="M2 21c0-4 3.5-6 7-6s7 2 7 6" /><circle cx="17" cy="9" r="2.5" /><path d="M22 19c0-2.8-2-4.5-5-4.5" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold text-tx-muted uppercase tracking-wide mb-1.5">
                    Enseignants supervisés ({(modal.sup.classes ?? []).length})
                  </div>
                  {assignedTeachers(modal.sup.classes).length === 0 ? (
                    <p className="text-sm text-tx-muted italic">Aucun enseignant assigné</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {assignedTeachers(modal.sup.classes).map(t => (
                        <span key={t.id} className="inline-flex items-center gap-1 bg-primary-soft text-primary text-xs font-medium px-2 py-0.5 rounded-full">
                          <span className="w-4 h-4 rounded-full bg-primary text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0">{initials(t.name)}</span>
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Boutons */}
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors">
                Fermer
              </button>
              <button onClick={() => setModal({ kind: "manage", sup: modal.sup })}
                className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                Gérer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmation toggle ── */}
      {modal && typeof modal === "object" && modal.kind === "toggle" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-4 mb-5">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${modal.sup.status === "actif" ? "bg-warn-soft" : "bg-success-soft"}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  className={modal.sup.status === "actif" ? "text-warn" : "text-success"}>
                  <path d="M18.36 6.64a9 9 0 11-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-tx">
                  {modal.sup.status === "actif" ? "Désactiver le superviseur" : "Activer le superviseur"}
                </h2>
                <p className="text-sm text-tx-muted mt-1">
                  {modal.sup.status === "actif"
                    ? <>Voulez-vous désactiver le compte de <strong className="text-tx">{modal.sup.name}</strong> ? Il ne pourra plus accéder à la plateforme.</>
                    : <>Voulez-vous réactiver le compte de <strong className="text-tx">{modal.sup.name}</strong> ? Il pourra de nouveau accéder à la plateforme.</>
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors">
                Annuler
              </button>
              <button onClick={() => doToggle(modal.sup)} disabled={loading}
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity ${modal.sup.status === "actif" ? "bg-warn" : "bg-success"}`}>
                {loading ? "…" : modal.sup.status === "actif" ? "Désactiver" : "Activer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Assignation enseignants ── */}
      {modal && typeof modal === "object" && modal.kind === "assign" && (() => {
        const sup = modal.sup;
        /* Enseignants de l'école du superviseur — ou tous si pas d'école */
        const eligible = sup.school_id
          ? teachers.filter(t => t.school_id === sup.school_id)
          : teachers;
        const allTeachers = teachers; /* pour afficher ceux d'autres écoles si déjà assignés */
        /* On affiche eligible + ceux déjà assignés hors école */
        const display = [
          ...eligible,
          ...allTeachers.filter(t => assignIds.includes(t.id) && !eligible.find(e => e.id === t.id)),
        ];
        const filtered2 = display.filter(t =>
          !assignSearch.trim() ||
          t.name.toLowerCase().includes(assignSearch.toLowerCase()) ||
          schoolNameById(t.school_id).toLowerCase().includes(assignSearch.toLowerCase())
        );
        const allSelected = display.length > 0 && display.every(t => assignIds.includes(t.id));
        const toggleAll = () => setAssignIds(allSelected ? [] : display.map(t => t.id));
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

              {/* En-tête */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-base font-bold text-tx">Enseignants assignés</h2>
                  <p className="text-xs text-tx-muted mt-0.5">{sup.name} · {schoolName(sup)}</p>
                </div>
                <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-lg text-tx-muted hover:text-tx hover:bg-surface-alt transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>

              {/* Recherche + compteur + tout sélectionner */}
              <div className="px-6 pt-4 pb-3 flex-shrink-0 space-y-3">
                <div className="relative">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
                    <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input value={assignSearch} onChange={e => setAssignSearch(e.target.value)}
                    placeholder="Rechercher un enseignant…"
                    className="w-full bg-bg border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-tx-muted">
                    <span className="font-semibold text-brand">{assignIds.length}</span> sélectionné{assignIds.length !== 1 ? "s" : ""} sur {display.length}
                  </span>
                  <button onClick={toggleAll} className="text-xs text-brand font-semibold hover:underline">
                    {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                  </button>
                </div>
              </div>

              {/* Liste enseignants */}
              <div className="flex-1 overflow-y-auto px-6 pb-3 space-y-2">
                {filtered2.length === 0 && (
                  <p className="text-sm text-tx-muted text-center py-8 italic">Aucun enseignant trouvé.</p>
                )}
                {filtered2.map(t => {
                  const sel = assignIds.includes(t.id);
                  const fromOtherSchool = sup.school_id && t.school_id !== sup.school_id;
                  return (
                    <button key={t.id} type="button" onClick={() => toggleAssignId(t.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${sel ? "border-brand bg-brand-soft" : "border-border bg-bg hover:border-brand/30 hover:bg-surface-alt"}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${sel ? "bg-brand text-white" : "bg-surface-alt text-tx-muted"}`}>
                        {initials(t.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${sel ? "text-brand" : "text-tx"}`}>{t.name}</div>
                        <div className="text-xs text-tx-muted mt-0.5 flex items-center gap-1.5">
                          {(t.classes ?? []).join(", ") || "—"}
                          {fromOtherSchool && (
                            <span className="text-warn bg-warn-soft px-1.5 py-0.5 rounded text-[10px] font-semibold">Autre école</span>
                          )}
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${sel ? "border-brand bg-brand" : "border-border"}`}>
                        {sel && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Pied */}
              <div className="px-6 py-4 border-t border-border flex gap-3 flex-shrink-0">
                <button onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors">
                  Annuler
                </button>
                <button onClick={() => saveAssign(sup)} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
                  {loading ? "Enregistrement…" : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12l5 5 9-11" /></svg>Enregistrer ({assignIds.length})</>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal Suppression ── */}
      {modal && typeof modal === "object" && modal.kind === "delete" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-danger-soft flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-tx">Supprimer le superviseur</h2>
                <p className="text-sm text-tx-muted mt-1">
                  Voulez-vous supprimer <strong className="text-tx">{modal.sup.name}</strong> ? Cette action est irréversible.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors">
                Annuler
              </button>
              <button onClick={() => doDelete(modal.sup)} disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-danger text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {loading ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
