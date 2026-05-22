"use client";
import { useEffect, useRef, useState } from "react";
import { teachersApi, schoolsApi, exportApi } from "@/lib/api";
import { downloadBlob } from "@/lib/csv";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

interface Teacher {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  title?: string;
  status: string;
  school_id?: string;
  school?: { id: string; name: string; region?: string };  // objet joint depuis l'API
  niveau?: string[];
  classes?: string[];
}
interface School { id: string; name: string; }
const EMPTY_T = { name: "", phone: "", title: "", school_id: "", niveau: [] as string[], classes: [] as string[] };
const NIVEAUX  = ["CP", "CE1", "CE2", "CM1", "CM2"] as const;
const ALL_CLASSES_BY_NIVEAU: Record<string, string[]> = {
  CP:  ["CP A", "CP B", "CP C", "CP D"],
  CE1: ["CE1 A", "CE1 B", "CE1 C", "CE1 D"],
  CE2: ["CE2 A", "CE2 B", "CE2 C", "CE2 D"],
  CM1: ["CM1 A", "CM1 B", "CM1 C"],
  CM2: ["CM2 A", "CM2 B", "CM2 C"],
};
/** Retourne les classes disponibles selon les niveaux sélectionnés (+ Enseignant Communautaire toujours dispo). */
function getAvailableClasses(niveaux: string[]): string[] {
  if (!niveaux || niveaux.length === 0) {
    return Object.values(ALL_CLASSES_BY_NIVEAU).flat().concat(["Enseignant Communautaire"]);
  }
  return niveaux.flatMap(n => ALL_CLASSES_BY_NIVEAU[n] ?? []).concat(["Enseignant Communautaire"]);
}

type ModalState = null | "create"
  | { kind: "view"; teacher: Teacher }
  | { kind: "manage"; teacher: Teacher }
  | { kind: "toggle"; teacher: Teacher }
  | { kind: "edit"; teacher: Teacher }
  | { kind: "delete"; teacher: Teacher };

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState<typeof EMPTY_T>(EMPTY_T);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState("");
  const [search, setSearch] = useState("");
  const [filterSchool, setFilterSchool] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [page, setPage] = useState(1);
  const importRef = useRef<HTMLInputElement>(null);

  const load = () => {
    teachersApi.list().then(r => setTeachers(r.data.items ?? [])).catch(() => { });
    schoolsApi.list().then(r => setSchools(r.data.items ?? [])).catch(() => { });
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [search, filterSchool, filterStatus]);

  const hasFilters = !!(search || filterSchool || filterStatus);
  const filtered = teachers.filter(t => {
    const matchSearch = !search.trim() || t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.email?.toLowerCase().includes(search.toLowerCase()) || t.phone?.includes(search);
    const matchSchool = !filterSchool || t.school_id === filterSchool;
    const matchStatus = !filterStatus || t.status === filterStatus;
    return matchSearch && matchSchool && matchStatus;
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportApi.teachers();
      downloadBlob(res.data, "enseignants.csv");
    } catch { /* silencieux */ }
    finally { setExporting(false); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await teachersApi.importCsv(file);
      const count = res.data?.imported ?? res.data?.count ?? "?";
      setImportMsg({ ok: true, text: `${count} enseignant${count !== 1 ? "s" : ""} importé${count !== 1 ? "s" : ""} avec succès.` });
      load();
    } catch (err: any) {
      setImportMsg({ ok: false, text: err?.response?.data?.detail ?? "Erreur lors de l'import." });
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const checkPhone = (phone: string, excludeId?: string) => {
    const t = phone.trim().replace(/\D/g, "");
    if (!phone.trim()) { setPhoneError(""); return; }
    if (t.length !== 9) { setPhoneError("Le numéro doit contenir exactement 9 chiffres."); return; }
    const dup = teachers.find(x => x.phone?.trim().replace(/\D/g, "") === t && x.id !== excludeId);
    setPhoneError(dup ? `Ce numéro est déjà utilisé par « ${dup.name} ».` : "");
  };

  const save = async () => {
    if (phoneError) return;
    // Vérification côté client : le téléphone est requis à la création
    if (modal === "create" && !form.phone?.trim()) {
      setSaveError("Le numéro de téléphone est requis (il sert d'identifiant de connexion).");
      return;
    }
    setSaveError(null);
    setLoading(true);
    try {
      // Nettoyer les champs vides avant envoi : "" → undefined pour les UUID optionnels
      const payload = {
        ...form,
        title:     form.title     || undefined,
        phone:     form.phone     || undefined,
        school_id: form.school_id || undefined,
        niveau:    form.niveau?.length  ? form.niveau  : undefined,
        classes:   form.classes?.length ? form.classes : undefined,
      };
      if (modal === "create") {
        await teachersApi.create({ ...payload, password: "P@sser123", role: "enseignant" });
      } else if (modal && typeof modal === "object" && modal.kind === "edit") {
        await teachersApi.update(modal.teacher.id, payload);
      }
      load();
      setModal(null);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      // detail peut être une string ou un tableau Pydantic [{loc, msg, type}]
      if (Array.isArray(detail)) {
        setSaveError(detail.map((e: any) => e.msg ?? String(e)).join(" · "));
      } else {
        setSaveError(detail ?? "Une erreur est survenue. Vérifiez les champs et réessayez.");
      }
    } finally { setLoading(false); }
  };

  const doToggle = async (t: Teacher) => {
    setLoading(true);
    try { await teachersApi.toggleStatus(t.id); load(); setModal(null); }
    finally { setLoading(false); }
  };

  const doDelete = async (t: Teacher) => {
    setLoading(true);
    try { await teachersApi.delete(t.id); load(); setModal(null); }
    finally { setLoading(false); }
  };

  const initials = (n: string) => n.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

  const managed = (modal && typeof modal === "object" && "kind" in modal && (modal.kind === "manage" || modal.kind === "delete" || modal.kind === "edit"))
    ? (modal as { kind: string; teacher: Teacher }).teacher : null;

  return (
    <div className="flex flex-col min-h-full px-7 pb-7">
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Gestion Enseignants</h1>
          <p className="text-tx-muted text-sm mt-0.5">
            {hasFilters
              ? `${filtered.length} résultat${filtered.length !== 1 ? "s" : ""} sur ${teachers.length} enseignant${teachers.length !== 1 ? "s" : ""} · Page ${page}/${Math.ceil(filtered.length / PAGE_SIZE) || 1}`
              : `${teachers.length} enseignant${teachers.length !== 1 ? "s" : ""} au total · Page ${page}/${Math.ceil(filtered.length / PAGE_SIZE) || 1}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Message import */}
          {importMsg && (
            <span className={`text-xs font-medium px-3 py-1.5 rounded-xl ${importMsg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
              {importMsg.text}
              <button onClick={() => setImportMsg(null)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
            </span>
          )}
          {/* Exporter CSV */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 bg-surface border border-border hover:bg-surface-alt text-tx px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {exporting ? "Export…" : "Exporter CSV"}
          </button>
          {/* Importer CSV */}
          <div className="relative group">
            <button
              onClick={() => importRef.current?.click()}
              title={`Format attendu : name,phone,title,email,school_id,classes\nLes classes sont séparées par le caractère |`}
              className="flex items-center gap-2 bg-surface border border-border hover:bg-surface-alt text-tx px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Importer CSV
            </button>
            <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          </div>
          {/* Ajouter */}
          <button onClick={() => { setForm(EMPTY_T); setSaveError(null); setModal("create"); }}
            className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Ajouter
          </button>
        </div>
      </div>

      {/* Barre de recherche + filtres */}
      <div className="flex gap-3 mb-5">
        {/* Recherche */}
        <div className="relative flex-1">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email, téléphone…"
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tx-muted hover:text-tx">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* Filtre École */}
        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <path d="M3 9l9-5 9 5-9 5-9-5z" /><path d="M5 10v6c0 2 3 4 7 4s7-2 7-4v-6" />
          </svg>
          <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)}
            className={`pl-8 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none min-w-[170px] ${filterSchool ? "border-brand text-brand font-medium" : "border-border text-tx"
              }`}>
            <option value="">Toutes les écoles</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        {/* Filtre Statut */}
        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
          </svg>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className={`pl-8 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none min-w-[140px] ${filterStatus ? "border-brand text-brand font-medium" : "border-border text-tx"
              }`}>
            <option value="">Tous les statuts</option>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        {/* Reset */}
        {hasFilters && (
          <button onClick={() => { setSearch(""); setFilterSchool(""); setFilterStatus(""); }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-brand/30 bg-brand-soft text-brand text-sm font-medium hover:bg-brand hover:text-white transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            Réinitialiser
          </button>
        )}
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden flex-1">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[20%]" />   {/* Enseignant */}
            <col className="w-[13%]" />   {/* Contact */}
            <col className="w-[16%]" />   {/* École */}
            <col className="w-[14%]" />   {/* IEF */}
            <col className="w-[10%]" />   {/* Niveau */}
            <col className="w-[14%]" />   {/* Classes */}
            <col className="w-[8%]" />    {/* Statut */}
            <col className="w-[5%]" />    {/* Actions */}
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              {["Enseignant", "Contact", "École", "IEF", "Niveau", "Classes", "Statut", "Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-tx-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map(t => {
              const schoolName = t.school?.name ?? schools.find(s => s.id === t.school_id)?.name ?? "—";
              const schoolIef  = t.school?.region ?? "—";
              return (
                <tr key={t.id} onClick={() => setModal({ kind: "view", teacher: t })}
                  className="border-t border-border hover:bg-surface-alt transition-colors cursor-pointer">

                  {/* Enseignant */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary-soft text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {initials(t.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-tx truncate">{t.name}</div>
                        {t.title && <div className="text-xs text-tx-muted truncate">{t.title}</div>}
                      </div>
                    </div>
                  </td>

                  {/* Contact */}
                  <td className="px-4 py-3.5 text-tx-muted text-sm">{t.phone ?? "—"}</td>

                  {/* École */}
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-tx truncate block" title={schoolName}>{schoolName}</span>
                  </td>

                  {/* IEF */}
                  <td className="px-4 py-3.5">
                    {schoolIef !== "—"
                      ? <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-warn-soft text-warn">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M5 10v6c0 2 3 4 7 4s7-2 7-4v-6"/></svg>
                          {schoolIef}
                        </span>
                      : <span className="text-tx-muted text-xs">—</span>}
                  </td>

                  {/* Niveau */}
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1 flex-wrap">
                      {(t.niveau && t.niveau.length > 0)
                        ? t.niveau.map(n => (
                          <span key={n} className="bg-warn-soft text-warn text-[11px] font-bold px-2 py-0.5 rounded-md">{n}</span>
                        ))
                        : <span className="text-tx-muted text-xs">—</span>}
                    </div>
                  </td>

                  {/* Classes */}
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1 flex-wrap">
                      {(t.classes && t.classes.length > 0)
                        ? t.classes.map(c => (
                          <span key={c} className="bg-primary-soft text-primary text-[11px] font-bold px-2 py-0.5 rounded-md">{c}</span>
                        ))
                        : <span className="text-tx-muted text-xs">—</span>}
                    </div>
                  </td>

                  {/* Statut */}
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${t.status === "actif" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${t.status === "actif" ? "bg-success" : "bg-danger"}`} />
                      {t.status}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setModal({ kind: "manage", teacher: t })}
                      className="text-xs bg-primary-soft text-primary px-3 py-1 rounded-lg font-medium hover:bg-primary hover:text-white transition-colors">
                      Gérer
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-16 text-center text-tx-muted text-sm">
                {hasFilters ? "Aucun enseignant ne correspond aux filtres." : "Aucun enseignant pour l'instant"}
              </td></tr>
            )}
          </tbody>
        </table>
        <div className="pb-4 px-5">
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      {/* ── Modal Vue détail ──────────────────────────────────────────── */}
      {modal && typeof modal === "object" && modal.kind === "view" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm">
            {/* En-tête coloré */}
            <div className="bg-primary-soft rounded-t-2xl px-6 pt-6 pb-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                {initials(modal.teacher.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-tx text-base truncate">{modal.teacher.name}</div>
                {modal.teacher.title && <div className="text-xs text-tx-muted mt-0.5">{modal.teacher.title}</div>}
                <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${modal.teacher.status === "actif" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${modal.teacher.status === "actif" ? "bg-success" : "bg-danger"}`} />
                  {modal.teacher.status}
                </span>
              </div>
            </div>
            {/* Infos */}
            <div className="px-6 py-4 space-y-3">
              {[
                { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.12 1.22 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" /></svg>, label: "Téléphone", value: modal.teacher.phone ?? "—" },
                { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-5 9 5-9 5-9-5z" /><path d="M5 10v6c0 2 3 4 7 4s7-2 7-4v-6" /></svg>, label: "École", value: modal.teacher.school?.name ?? schools.find(s => s.id === modal.teacher.school_id)?.name ?? "—" },
                { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>, label: "IEF", value: modal.teacher.school?.region ?? "—" },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-surface-alt flex items-center justify-center text-tx-muted flex-shrink-0">{icon}</div>
                  <div>
                    <div className="text-[11px] text-tx-muted">{label}</div>
                    <div className="text-sm font-medium text-tx">{value}</div>
                  </div>
                </div>
              ))}
              {/* Niveau */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-surface-alt flex items-center justify-center text-tx-muted flex-shrink-0 mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 20h20M6 20V10l6-6 6 6v10"/><path d="M10 20v-6h4v6"/></svg>
                </div>
                <div>
                  <div className="text-[11px] text-tx-muted mb-1">Niveau</div>
                  {modal.teacher.niveau && modal.teacher.niveau.length > 0 ? (
                    <div className="flex gap-1 flex-wrap">
                      {modal.teacher.niveau.map(n => (
                        <span key={n} className="bg-warn-soft text-warn text-[11px] font-bold px-2 py-0.5 rounded-md">{n}</span>
                      ))}
                    </div>
                  ) : <span className="text-sm text-tx-muted">—</span>}
                </div>
              </div>
              {/* Classes */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-surface-alt flex items-center justify-center text-tx-muted flex-shrink-0 mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>
                </div>
                <div>
                  <div className="text-[11px] text-tx-muted mb-1">Classes</div>
                  {modal.teacher.classes && modal.teacher.classes.length > 0 ? (
                    <div className="flex gap-1 flex-wrap">
                      {modal.teacher.classes.map(c => (
                        <span key={c} className="bg-primary-soft text-primary text-[11px] font-bold px-2 py-0.5 rounded-md">{c}</span>
                      ))}
                    </div>
                  ) : <span className="text-sm text-tx-muted">—</span>}
                </div>
              </div>
            </div>
            {/* Actions */}
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors">
                Fermer
              </button>
              <button onClick={() => setModal({ kind: "manage", teacher: modal.teacher })}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                Gérer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmation Désactivation ──────────────────────────── */}
      {modal && typeof modal === "object" && modal.kind === "toggle" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-4 mb-5">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${modal.teacher.status === "actif" ? "bg-warn/10" : "bg-success/10"}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={modal.teacher.status === "actif" ? "text-warn" : "text-success"}>
                  <path d="M18.36 6.64a9 9 0 11-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-tx">
                  {modal.teacher.status === "actif" ? "Désactiver l'enseignant" : "Activer l'enseignant"}
                </h2>
                <p className="text-sm text-tx-muted mt-1">
                  {modal.teacher.status === "actif"
                    ? <>Voulez-vous désactiver le compte de <span className="font-semibold text-tx">{modal.teacher.name}</span> ? Il ne pourra plus se connecter.</>
                    : <>Voulez-vous réactiver le compte de <span className="font-semibold text-tx">{modal.teacher.name}</span> ? Il pourra à nouveau se connecter.</>
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">Annuler</button>
              <button onClick={() => doToggle(modal.teacher)} disabled={loading}
                className={`px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-colors ${modal.teacher.status === "actif" ? "bg-warn hover:bg-warn/90" : "bg-success hover:bg-success/90"}`}>
                {loading ? "En cours…" : (modal.teacher.status === "actif" ? "Désactiver" : "Activer")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Gérer ───────────────────────────────────────────────── */}
      {modal && typeof modal === "object" && "kind" in modal && modal.kind === "manage" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary-soft text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                {initials(modal.teacher.name)}
              </div>
              <div>
                <div className="font-semibold text-tx">{modal.teacher.name}</div>
                {modal.teacher.title && <div className="text-xs text-tx-muted">{modal.teacher.title}</div>}
              </div>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => { const t = modal.teacher; setModal({ kind: "edit", teacher: t }); setForm({ ...EMPTY_T, ...t }); setPhoneError(""); setSaveError(null); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-alt hover:bg-primary-soft text-tx hover:text-primary text-sm font-medium transition-colors text-left">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                Modifier l'enseignant
              </button>
              <button
                onClick={() => setModal({ kind: "toggle", teacher: modal.teacher })}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left ${modal.teacher.status === "actif" ? "bg-surface-alt hover:bg-warn-soft text-tx hover:text-warn" : "bg-surface-alt hover:bg-success-soft text-tx hover:text-success"}`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 11-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" /></svg>
                {modal.teacher.status === "actif" ? "Désactiver l'enseignant" : "Activer l'enseignant"}
              </button>
              <button
                onClick={() => setModal({ kind: "delete", teacher: modal.teacher })}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-alt hover:bg-danger-soft text-tx hover:text-danger text-sm font-medium transition-colors text-left">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                Supprimer l'enseignant
              </button>
            </div>
            <button onClick={() => setModal(null)} className="mt-4 w-full px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">Annuler</button>
          </div>
        </div>
      )}

      {/* ── Modal Modifier ────────────────────────────────────────────── */}
      {modal && typeof modal === "object" && "kind" in modal && modal.kind === "edit" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-tx mb-5">Modifier l'enseignant</h2>
            {saveError && (
              <div className="mb-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-danger-soft border border-danger/20 text-danger text-sm">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{saveError}</span>
              </div>
            )}
            <div className="space-y-3">
              {([["Nom complet", "name"], ["Titre (optionnel)", "title"]] as [string, string][]).map(([l, k]) => (
                <div key={k}>
                  <label className="block text-sm font-medium text-tx mb-1">{l}</label>
                  <input type="text" value={(form as any)[k] ?? ""}
                    onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-tx mb-1">Téléphone</label>
                <input type="tel" value={form.phone ?? ""}
                  onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); const excl = modal && typeof modal === "object" && modal.kind === "edit" ? modal.teacher.id : undefined; checkPhone(e.target.value, excl); }}
                  placeholder="77 XXX XX XX"
                  className={`w-full bg-surface-alt border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 transition ${phoneError ? "border-danger focus:ring-danger/30" : "border-border focus:ring-brand/30"}`} />
                {phoneError && <p className="mt-1.5 text-xs text-danger flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>{phoneError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-tx mb-1">École</label>
                <select value={form.school_id} onChange={e => setForm(f => ({ ...f, school_id: e.target.value }))}
                  className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition">
                  <option value="">— Sélectionner —</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-tx mb-2">Niveau</label>
                <div className="flex flex-wrap gap-2">
                  {NIVEAUX.map(niv => (
                    <label key={niv}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-colors select-none ${form.niveau?.includes(niv)
                          ? "border-warn bg-warn-soft text-warn font-semibold"
                          : "border-border bg-surface-alt text-tx hover:border-warn/40"
                        }`}
                    >
                      <input type="checkbox" className="hidden"
                        checked={form.niveau?.includes(niv) ?? false}
                        onChange={e => setForm(f => {
                          const newNiveau = e.target.checked
                            ? [...(f.niveau ?? []), niv]
                            : (f.niveau ?? []).filter(n => n !== niv);
                          const valid = getAvailableClasses(newNiveau);
                          return {
                            ...f,
                            niveau: newNiveau,
                            classes: (f.classes ?? []).filter(c => valid.includes(c)),
                          };
                        })}
                      />
                      <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${form.niveau?.includes(niv) ? "bg-warn border-warn" : "border-border bg-surface"}`}>
                        {form.niveau?.includes(niv) && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        )}
                      </span>
                      {niv}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-tx mb-2">Classes</label>
                <div className="flex flex-wrap gap-2">
                  {getAvailableClasses(form.niveau).map(cls => (
                    <label key={cls}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-colors select-none ${form.classes?.includes(cls)
                          ? "border-brand bg-brand-soft text-brand font-semibold"
                          : "border-border bg-surface-alt text-tx hover:border-brand/40"
                        }`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={form.classes?.includes(cls) ?? false}
                        onChange={e => setForm(f => ({
                          ...f,
                          classes: e.target.checked
                            ? [...(f.classes ?? []), cls]
                            : (f.classes ?? []).filter(c => c !== cls),
                        }))}
                      />
                      <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${form.classes?.includes(cls)
                          ? "bg-brand border-brand"
                          : "border-border bg-surface"
                        }`}>
                        {form.classes?.includes(cls) && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                      {cls}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">Annuler</button>
              <button onClick={save} disabled={loading || !!phoneError} className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {loading ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Créer ───────────────────────────────────────────────── */}
      {modal === "create" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-tx mb-5">Nouvel enseignant</h2>
            {saveError && (
              <div className="mb-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-danger-soft border border-danger/20 text-danger text-sm">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{saveError}</span>
              </div>
            )}
            <div className="space-y-3">
              {([["Nom complet", "name"], ["Titre (optionnel)", "title"]] as [string, string][]).map(([l, k]) => (
                <div key={k}>
                  <label className="block text-sm font-medium text-tx mb-1">{l}</label>
                  <input type="text" value={(form as any)[k] ?? ""}
                    onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-tx mb-1">
                  Téléphone <span className="text-danger">*</span>
                  <span className="text-tx-muted font-normal ml-1">(identifiant de connexion)</span>
                </label>
                <input type="tel" value={form.phone ?? ""}
                  onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); checkPhone(e.target.value); }}
                  placeholder="77 XXX XX XX"
                  className={`w-full bg-surface-alt border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 transition ${phoneError ? "border-danger focus:ring-danger/30" : "border-border focus:ring-brand/30"}`} />
                {phoneError && <p className="mt-1.5 text-xs text-danger flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>{phoneError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-tx mb-1">École</label>
                <select value={form.school_id} onChange={e => setForm(f => ({ ...f, school_id: e.target.value }))}
                  className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition">
                  <option value="">— Sélectionner (optionnel) —</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-tx mb-2">Niveau</label>
                <div className="flex flex-wrap gap-2">
                  {NIVEAUX.map(niv => (
                    <label key={niv}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-colors select-none ${form.niveau?.includes(niv)
                          ? "border-warn bg-warn-soft text-warn font-semibold"
                          : "border-border bg-surface-alt text-tx hover:border-warn/40"
                        }`}
                    >
                      <input type="checkbox" className="hidden"
                        checked={form.niveau?.includes(niv) ?? false}
                        onChange={e => setForm(f => {
                          const newNiveau = e.target.checked
                            ? [...(f.niveau ?? []), niv]
                            : (f.niveau ?? []).filter(n => n !== niv);
                          const valid = getAvailableClasses(newNiveau);
                          return {
                            ...f,
                            niveau: newNiveau,
                            classes: (f.classes ?? []).filter(c => valid.includes(c)),
                          };
                        })}
                      />
                      <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${form.niveau?.includes(niv) ? "bg-warn border-warn" : "border-border bg-surface"}`}>
                        {form.niveau?.includes(niv) && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        )}
                      </span>
                      {niv}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-tx mb-2">Classes</label>
                <div className="flex flex-wrap gap-2">
                  {getAvailableClasses(form.niveau).map(cls => (
                    <label key={cls}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-colors select-none ${form.classes?.includes(cls)
                          ? "border-brand bg-brand-soft text-brand font-semibold"
                          : "border-border bg-surface-alt text-tx hover:border-brand/40"
                        }`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={form.classes?.includes(cls) ?? false}
                        onChange={e => setForm(f => ({
                          ...f,
                          classes: e.target.checked
                            ? [...(f.classes ?? []), cls]
                            : (f.classes ?? []).filter(c => c !== cls),
                        }))}
                      />
                      <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${form.classes?.includes(cls)
                          ? "bg-brand border-brand"
                          : "border-border bg-surface"
                        }`}>
                        {form.classes?.includes(cls) && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                      {cls}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">Annuler</button>
              <button onClick={save} disabled={loading || !!phoneError} className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {loading ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmation Suppression ────────────────────────────── */}
      {modal && typeof modal === "object" && "kind" in modal && modal.kind === "delete" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-danger-soft flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-tx">Supprimer l'enseignant</h2>
                <p className="text-sm text-tx-muted mt-1">
                  Êtes-vous sûr de vouloir supprimer <span className="font-semibold text-tx">{modal.teacher.name}</span> ? Cette action est irréversible.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">Annuler</button>
              <button onClick={() => doDelete(modal.teacher)} disabled={loading}
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
