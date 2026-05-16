"use client";
import { useEffect, useRef, useState } from "react";
import { teachersApi, schoolsApi, exportApi } from "@/lib/api";
import { downloadBlob } from "@/lib/csv";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

interface Teacher { id:string; name:string; phone?:string; email?:string; title?:string; status:string; school_id?:string; classes?:string[]; }
interface School  { id:string; name:string; }
const EMPTY_T = { name:"", phone:"", title:"", school_id:"", classes:[] as string[] };

type ModalState = null | "create"
  | { kind:"view";   teacher:Teacher }
  | { kind:"manage"; teacher:Teacher }
  | { kind:"toggle"; teacher:Teacher }
  | { kind:"edit";   teacher:Teacher }
  | { kind:"delete"; teacher:Teacher };

export default function TeachersPage() {
  const [teachers,      setTeachers]      = useState<Teacher[]>([]);
  const [schools,       setSchools]       = useState<School[]>([]);
  const [modal,         setModal]         = useState<ModalState>(null);
  const [form,          setForm]          = useState<typeof EMPTY_T>(EMPTY_T);
  const [loading,       setLoading]       = useState(false);
  const [phoneError,    setPhoneError]    = useState("");
  const [search,        setSearch]        = useState("");
  const [filterSchool,  setFilterSchool]  = useState("");
  const [filterStatus,  setFilterStatus]  = useState("");
  const [exporting,     setExporting]     = useState(false);
  const [importMsg,     setImportMsg]     = useState<{ ok: boolean; text: string } | null>(null);
  const [page,          setPage]          = useState(1);
  const importRef = useRef<HTMLInputElement>(null);

  const load = () => {
    teachersApi.list().then(r=>setTeachers(r.data.items??[])).catch(()=>{});
    schoolsApi.list().then(r=>setSchools(r.data.items??[])).catch(()=>{});
  };
  useEffect(()=>{ load(); },[]);
  useEffect(()=>{ setPage(1); },[search, filterSchool, filterStatus]);

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
    const t = phone.trim();
    if (!t) { setPhoneError(""); return; }
    const dup = teachers.find(x => x.phone?.trim() === t && x.id !== excludeId);
    setPhoneError(dup ? `Ce numéro est déjà utilisé par « ${dup.name} ».` : "");
  };

  const save = async () => {
    if (phoneError) return;
    setLoading(true);
    try {
      if (modal==="create") await teachersApi.create({...form, password:"P@sser123", role:"enseignant"});
      else if (modal && typeof modal==="object" && modal.kind==="edit") await teachersApi.update(modal.teacher.id, form);
      load(); setModal(null);
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

  const initials = (n:string)=>n.split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase();

  const managed = (modal && typeof modal==="object" && "kind" in modal && (modal.kind==="manage"||modal.kind==="delete"||modal.kind==="edit"))
    ? (modal as {kind:string;teacher:Teacher}).teacher : null;

  return (
    <div className="flex flex-col min-h-full px-7 pb-7">
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Gestion Enseignants</h1>
          <p className="text-tx-muted text-sm mt-0.5">
            {hasFilters
              ? `${filtered.length} résultat${filtered.length!==1?"s":""} sur ${teachers.length} enseignant${teachers.length!==1?"s":""} · Page ${page}/${Math.ceil(filtered.length/PAGE_SIZE)||1}`
              : `${teachers.length} enseignant${teachers.length!==1?"s":""} au total · Page ${page}/${Math.ceil(filtered.length/PAGE_SIZE)||1}`}
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Importer CSV
            </button>
            <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          </div>
          {/* Ajouter */}
          <button onClick={()=>{ setForm(EMPTY_T); setModal("create"); }}
            className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
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
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Rechercher par nom, email, téléphone…"
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"/>
          {search && (
            <button onClick={()=>setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tx-muted hover:text-tx">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {/* Filtre École */}
        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M5 10v6c0 2 3 4 7 4s7-2 7-4v-6"/>
          </svg>
          <select value={filterSchool} onChange={e=>setFilterSchool(e.target.value)}
            className={`pl-8 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none min-w-[170px] ${
              filterSchool ? "border-brand text-brand font-medium" : "border-border text-tx"
            }`}>
            <option value="">Toutes les écoles</option>
            {schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>

        {/* Filtre Statut */}
        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
          </svg>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
            className={`pl-8 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none min-w-[140px] ${
              filterStatus ? "border-brand text-brand font-medium" : "border-border text-tx"
            }`}>
            <option value="">Tous les statuts</option>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>

        {/* Reset */}
        {hasFilters && (
          <button onClick={()=>{ setSearch(""); setFilterSchool(""); setFilterStatus(""); }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-brand/30 bg-brand-soft text-brand text-sm font-medium hover:bg-brand hover:text-white transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            Réinitialiser
          </button>
        )}
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden flex-1">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[22%]"/>
            <col className="w-[18%]"/>
            <col className="w-[20%]"/>
            <col className="w-[17%]"/>
            <col className="w-[13%]"/>
            <col className="w-[10%]"/>
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              {["Enseignant","Contact","École","Classes","Statut","Actions"].map(h=>(
                <th key={h} className="px-5 py-3 text-center text-xs font-semibold text-tx-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map(t=>{
              const school=schools.find(s=>s.id===t.school_id);
              return (
                <tr key={t.id} onClick={()=>setModal({kind:"view",teacher:t})}
                  className="border-t border-border hover:bg-surface-alt transition-colors cursor-pointer">
                  <td className="px-5 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary-soft text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {initials(t.name)}
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-tx">{t.name}</div>
                        {t.title && <div className="text-xs text-tx-muted">{t.title}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-tx-muted text-center">{t.phone??"—"}</td>
                  <td className="px-5 py-3.5 text-tx-muted text-center">{school?.name??"—"}</td>
                  <td className="px-5 py-3.5 text-center">
                    <div className="flex gap-1 flex-wrap justify-center">
                      {(t.classes && t.classes.length > 0)
                        ? t.classes.map(c=>(
                            <span key={c} className="bg-primary-soft text-primary text-[11px] font-bold px-2 py-0.5 rounded-md">{c}</span>
                          ))
                        : "—"}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${t.status==="actif"?"bg-success-soft text-success":"bg-danger-soft text-danger"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${t.status==="actif"?"bg-success":"bg-danger"}`}/>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5" onClick={e=>e.stopPropagation()}>
                    <div className="flex justify-center">
                      <button onClick={()=>setModal({ kind:"manage", teacher:t })}
                        className="text-xs bg-primary-soft text-primary px-3 py-1 rounded-lg font-medium hover:bg-primary hover:text-white transition-colors">
                        Gérer
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length===0 && (
              <tr><td colSpan={6} className="px-5 py-16 text-center text-tx-muted text-sm">
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
      {modal && typeof modal==="object" && modal.kind==="view" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm">
            {/* En-tête coloré */}
            <div className="bg-primary-soft rounded-t-2xl px-6 pt-6 pb-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                {initials(modal.teacher.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-tx text-base truncate">{modal.teacher.name}</div>
                {modal.teacher.title && <div className="text-xs text-tx-muted mt-0.5">{modal.teacher.title}</div>}
                <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${modal.teacher.status==="actif"?"bg-success/10 text-success":"bg-danger/10 text-danger"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${modal.teacher.status==="actif"?"bg-success":"bg-danger"}`}/>
                  {modal.teacher.status}
                </span>
              </div>
            </div>
            {/* Infos */}
            <div className="px-6 py-4 space-y-3">
              {[
                { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.12 1.22 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>, label:"Téléphone", value: modal.teacher.phone??"—" },
                { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M5 10v6c0 2 3 4 7 4s7-2 7-4v-6"/></svg>, label:"École", value: schools.find(s=>s.id===modal.teacher.school_id)?.name??"—" },
              ].map(({icon, label, value}) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-surface-alt flex items-center justify-center text-tx-muted flex-shrink-0">{icon}</div>
                  <div>
                    <div className="text-[11px] text-tx-muted">{label}</div>
                    <div className="text-sm font-medium text-tx">{value}</div>
                  </div>
                </div>
              ))}
              {/* Classes */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-surface-alt flex items-center justify-center text-tx-muted flex-shrink-0 mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
                </div>
                <div>
                  <div className="text-[11px] text-tx-muted mb-1">Classes</div>
                  {modal.teacher.classes && modal.teacher.classes.length > 0 ? (
                    <div className="flex gap-1 flex-wrap">
                      {modal.teacher.classes.map(c=>(
                        <span key={c} className="bg-primary-soft text-primary text-[11px] font-bold px-2 py-0.5 rounded-md">{c}</span>
                      ))}
                    </div>
                  ) : <span className="text-sm text-tx-muted">—</span>}
                </div>
              </div>
            </div>
            {/* Actions */}
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={()=>setModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors">
                Fermer
              </button>
              <button onClick={()=>setModal({kind:"manage", teacher:modal.teacher})}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                Gérer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmation Désactivation ──────────────────────────── */}
      {modal && typeof modal==="object" && modal.kind==="toggle" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-4 mb-5">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${modal.teacher.status==="actif"?"bg-warn/10":"bg-success/10"}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={modal.teacher.status==="actif"?"text-warn":"text-success"}>
                  <path d="M18.36 6.64a9 9 0 11-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-tx">
                  {modal.teacher.status==="actif" ? "Désactiver l'enseignant" : "Activer l'enseignant"}
                </h2>
                <p className="text-sm text-tx-muted mt-1">
                  {modal.teacher.status==="actif"
                    ? <>Voulez-vous désactiver le compte de <span className="font-semibold text-tx">{modal.teacher.name}</span> ? Il ne pourra plus se connecter.</>
                    : <>Voulez-vous réactiver le compte de <span className="font-semibold text-tx">{modal.teacher.name}</span> ? Il pourra à nouveau se connecter.</>
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={()=>setModal(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">Annuler</button>
              <button onClick={()=>doToggle(modal.teacher)} disabled={loading}
                className={`px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-colors ${modal.teacher.status==="actif"?"bg-warn hover:bg-warn/90":"bg-success hover:bg-success/90"}`}>
                {loading ? "En cours…" : (modal.teacher.status==="actif" ? "Désactiver" : "Activer")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Gérer ───────────────────────────────────────────────── */}
      {modal && typeof modal==="object" && "kind" in modal && modal.kind==="manage" && (
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
                onClick={()=>{ const t=modal.teacher; setModal({kind:"edit",teacher:t}); setForm({...EMPTY_T,...t}); setPhoneError(""); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-alt hover:bg-primary-soft text-tx hover:text-primary text-sm font-medium transition-colors text-left">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Modifier l'enseignant
              </button>
              <button
                onClick={()=>setModal({kind:"toggle", teacher:modal.teacher})}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left ${modal.teacher.status==="actif"?"bg-surface-alt hover:bg-warn-soft text-tx hover:text-warn":"bg-surface-alt hover:bg-success-soft text-tx hover:text-success"}`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 11-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                {modal.teacher.status==="actif"?"Désactiver l'enseignant":"Activer l'enseignant"}
              </button>
              <button
                onClick={()=>setModal({ kind:"delete", teacher:modal.teacher })}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-alt hover:bg-danger-soft text-tx hover:text-danger text-sm font-medium transition-colors text-left">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Supprimer l'enseignant
              </button>
            </div>
            <button onClick={()=>setModal(null)} className="mt-4 w-full px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">Annuler</button>
          </div>
        </div>
      )}

      {/* ── Modal Modifier ────────────────────────────────────────────── */}
      {modal && typeof modal==="object" && "kind" in modal && modal.kind==="edit" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-tx mb-5">Modifier l'enseignant</h2>
            <div className="space-y-3">
              {([["Nom complet","name"],["Titre (optionnel)","title"]] as [string,string][]).map(([l,k])=>(
                <div key={k}>
                  <label className="block text-sm font-medium text-tx mb-1">{l}</label>
                  <input type="text" value={(form as any)[k]??""}
                    onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition"/>
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-tx mb-1">Téléphone</label>
                <input type="tel" value={form.phone??""}
                  onChange={e=>{ setForm(f=>({...f,phone:e.target.value})); const excl=modal && typeof modal==="object" && modal.kind==="edit"?modal.teacher.id:undefined; checkPhone(e.target.value,excl); }}
                  placeholder="77 XXX XX XX"
                  className={`w-full bg-surface-alt border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 transition ${phoneError?"border-danger focus:ring-danger/30":"border-border focus:ring-brand/30"}`}/>
                {phoneError && <p className="mt-1.5 text-xs text-danger flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{phoneError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-tx mb-1">École</label>
                <select value={form.school_id} onChange={e=>setForm(f=>({...f,school_id:e.target.value}))}
                  className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition">
                  <option value="">— Sélectionner —</option>
                  {schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-tx mb-1">Classes (séparées par virgule)</label>
                <input type="text" value={form.classes?.join(",")??""}
                  onChange={e=>setForm(f=>({...f,classes:e.target.value.split(",").map(c=>c.trim()).filter(Boolean)}))}
                  placeholder="CE1, CE2, CM1"
                  className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition"/>
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={()=>setModal(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">Annuler</button>
              <button onClick={save} disabled={loading||!!phoneError} className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {loading?"Enregistrement…":"Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Créer ───────────────────────────────────────────────── */}
      {modal==="create" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-tx mb-5">Nouvel enseignant</h2>
            <div className="space-y-3">
              {([["Nom complet","name"],["Titre (optionnel)","title"]] as [string,string][]).map(([l,k])=>(
                <div key={k}>
                  <label className="block text-sm font-medium text-tx mb-1">{l}</label>
                  <input type="text" value={(form as any)[k]??""}
                    onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition"/>
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-tx mb-1">Téléphone</label>
                <input type="tel" value={form.phone??""}
                  onChange={e=>{ setForm(f=>({...f,phone:e.target.value})); checkPhone(e.target.value); }}
                  placeholder="77 XXX XX XX"
                  className={`w-full bg-surface-alt border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 transition ${phoneError?"border-danger focus:ring-danger/30":"border-border focus:ring-brand/30"}`}/>
                {phoneError && <p className="mt-1.5 text-xs text-danger flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{phoneError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-tx mb-1">École</label>
                <select value={form.school_id} onChange={e=>setForm(f=>({...f,school_id:e.target.value}))}
                  className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition">
                  <option value="">— Sélectionner —</option>
                  {schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-tx mb-1">Classes (séparées par virgule)</label>
                <input type="text" value={form.classes?.join(",")??""}
                  onChange={e=>setForm(f=>({...f,classes:e.target.value.split(",").map(c=>c.trim()).filter(Boolean)}))}
                  placeholder="CE1, CE2, CM1"
                  className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition"/>
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={()=>setModal(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">Annuler</button>
              <button onClick={save} disabled={loading||!!phoneError} className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {loading?"Enregistrement…":"Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmation Suppression ────────────────────────────── */}
      {modal && typeof modal==="object" && "kind" in modal && modal.kind==="delete" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-danger-soft flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-tx">Supprimer l'enseignant</h2>
                <p className="text-sm text-tx-muted mt-1">
                  Êtes-vous sûr de vouloir supprimer <span className="font-semibold text-tx">{modal.teacher.name}</span> ? Cette action est irréversible.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={()=>setModal(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">Annuler</button>
              <button onClick={()=>doDelete(modal.teacher)} disabled={loading}
                className="px-4 py-2 rounded-xl bg-danger hover:bg-danger/90 text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {loading?"Suppression…":"Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
