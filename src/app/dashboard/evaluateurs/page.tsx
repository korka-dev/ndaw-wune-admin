"use client";
import { useEffect, useState } from "react";
import { evaluateursApi, schoolsApi, teachersApi } from "@/lib/api";

interface Evaluateur {
  id: string; name: string; email?: string; phone?: string; title?: string;
  status: string; school_id?: string; assigned_teacher_ids?: string[];
}
interface School  { id: string; name: string; }
interface Teacher { id: string; name: string; school_id?: string; classes?: string[]; }

const EMPTY = { name:"", email:"", phone:"", title:"", school_id:"", assigned_teacher_ids:[] as string[] };
type ModalState = null | "create" | { kind:"edit"; ev:Evaluateur } | { kind:"delete"; ev:Evaluateur };

export default function EvaluateursPage() {
  const [evs,      setEvs]      = useState<Evaluateur[]>([]);
  const [schools,  setSchools]  = useState<School[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [modal,    setModal]    = useState<ModalState>(null);
  const [form,     setForm]     = useState<typeof EMPTY>(EMPTY);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState("");

  const load = () => {
    evaluateursApi.list().then(r => setEvs(r.data.items ?? [])).catch(() => {});
    schoolsApi.list().then(r => setSchools(r.data.items ?? [])).catch(() => {});
    teachersApi.list().then(r => setTeachers(r.data.items ?? [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setLoading(true);
    try {
      if (modal === "create") {
        await evaluateursApi.create({ ...form, password: "P@sser123", role: "evaluateur" });
      } else if (modal && typeof modal === "object" && modal.kind === "edit") {
        await evaluateursApi.update(modal.ev.id, form);
      }
      load(); setModal(null);
    } finally { setLoading(false); }
  };

  const doDelete = async (ev: Evaluateur) => {
    setLoading(true);
    try { await evaluateursApi.delete(ev.id); load(); setModal(null); }
    finally { setLoading(false); }
  };

  const doToggle = async (ev: Evaluateur) => {
    setLoading(true);
    try { await evaluateursApi.toggleStatus(ev.id); load(); setModal(null); }
    finally { setLoading(false); }
  };

  const toggleTeacher = (id: string) => {
    setForm(f => ({
      ...f,
      assigned_teacher_ids: f.assigned_teacher_ids.includes(id)
        ? f.assigned_teacher_ids.filter(x => x !== id)
        : [...f.assigned_teacher_ids, id],
    }));
  };

  const initials   = (n: string) => n.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  const schoolName = (id?: string) => schools.find(s => s.id === id)?.name ?? "—";
  const schoolTeachers = (schoolId: string) => teachers.filter(t => (t as any).school_id === schoolId);
  const assignedTeachers = (ids?: string[]) => teachers.filter(t => ids?.includes(t.id));

  const filtered = evs.filter(e =>
    !search.trim() || e.name.toLowerCase().includes(search.toLowerCase()) ||
    schoolName(e.school_id).toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => { setForm(EMPTY); setModal("create"); };
  const openEdit = (ev: Evaluateur) => {
    setForm({ name:ev.name, email:ev.email??"", phone:ev.phone??"", title:ev.title??"", school_id:ev.school_id??"", assigned_teacher_ids:ev.assigned_teacher_ids??[] });
    setModal({ kind:"edit", ev });
  };

  const FormModal = ({ title, onSave }: { title: string; onSave: () => void }) => (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-surface">
          <h2 className="text-base font-bold text-tx">{title}</h2>
          <button onClick={() => setModal(null)} className="text-tx-muted hover:text-tx transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-tx-muted mb-1.5 block">Nom complet *</label>
            <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Ex : Mme Fatou Ndiaye"
              className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm bg-bg text-tx outline-none focus:border-brand transition-colors" />
          </div>
          <div>
            <label className="text-xs font-semibold text-tx-muted mb-1.5 block">Téléphone</label>
            <input value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} placeholder="77 XXX XX XX"
              className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm bg-bg text-tx outline-none focus:border-brand transition-colors" />
          </div>
          <div>
            <label className="text-xs font-semibold text-tx-muted mb-1.5 block">Email</label>
            <input value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} placeholder="evaluateur@email.com" type="email"
              className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm bg-bg text-tx outline-none focus:border-brand transition-colors" />
          </div>
          <div>
            <label className="text-xs font-semibold text-tx-muted mb-1.5 block">École de suivi</label>
            <select value={form.school_id} onChange={e => setForm(f=>({...f,school_id:e.target.value,assigned_teacher_ids:[]}))}
              className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm bg-bg text-tx outline-none focus:border-brand transition-colors">
              <option value="">-- Sélectionner une école --</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {form.school_id && (
            <div>
              <label className="text-xs font-semibold text-tx-muted mb-2 block">
                Enseignants à évaluer{" "}
                <span className="text-brand font-bold">({form.assigned_teacher_ids.length} sélectionné{form.assigned_teacher_ids.length !== 1 ? "s" : ""})</span>
              </label>
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                {schoolTeachers(form.school_id).length === 0 ? (
                  <p className="text-sm text-tx-muted italic py-2">Aucun enseignant dans cette école</p>
                ) : schoolTeachers(form.school_id).map(t => {
                  const sel = form.assigned_teacher_ids.includes(t.id);
                  return (
                    <button key={t.id} onClick={() => toggleTeacher(t.id)} type="button"
                      className={`flex items-center gap-3 p-2.5 rounded-xl border-2 text-left transition-all ${sel ? "border-brand bg-brand-soft" : "border-border bg-bg hover:border-brand/40"}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${sel ? "bg-brand text-white" : "bg-surface-alt text-tx-muted"}`}>{initials(t.name)}</div>
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${sel ? "text-brand" : "text-tx"}`}>{t.name}</div>
                        <div className="text-xs text-tx-muted">{(t.classes ?? []).join(", ") || "—"}</div>
                      </div>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${sel ? "border-brand bg-brand" : "border-border"}`}>
                        {sel && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors">Annuler</button>
            <button onClick={onSave} disabled={loading || !form.name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
              {loading ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-full px-7 pb-7">
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Gestion Évaluateurs</h1>
          <p className="text-tx-muted text-sm mt-0.5">{evs.length} évaluateur{evs.length !== 1 ? "s" : ""} au total</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Ajouter
        </button>
      </div>

      <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-4 py-2.5 mb-5 w-full max-w-sm">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-tx-muted flex-shrink-0"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un évaluateur…"
          className="flex-1 bg-transparent text-sm text-tx outline-none placeholder:text-tx-muted" />
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden flex-1">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[24%]"/><col className="w-[16%]"/><col className="w-[22%]"/><col className="w-[18%]"/><col className="w-[10%]"/><col className="w-[10%]"/>
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              {["Évaluateur","Contact","École","Enseignants évalués","Statut","Actions"].map(h => (
                <th key={h} className="px-5 py-3 text-center text-xs font-semibold text-tx-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-tx-muted text-sm">Aucun évaluateur trouvé</td></tr>
            )}
            {filtered.map(ev => {
              const assigned = assignedTeachers(ev.assigned_teacher_ids);
              return (
                <tr key={ev.id} className="border-t border-border hover:bg-surface-alt transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-purple-soft text-purple flex items-center justify-center text-xs font-bold flex-shrink-0">{initials(ev.name)}</div>
                      <div>
                        <div className="font-medium text-tx">{ev.name}</div>
                        {ev.title && <div className="text-xs text-tx-muted">{ev.title}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-tx-muted text-center text-xs">{ev.email ?? ev.phone ?? "—"}</td>
                  <td className="px-5 py-3.5 text-tx-muted text-center text-xs">{schoolName(ev.school_id)}</td>
                  <td className="px-5 py-3.5 text-center">
                    {assigned.length > 0 ? (
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {assigned.slice(0,3).map(t=>(
                          <span key={t.id} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-soft text-primary text-[9px] font-bold" title={t.name}>{initials(t.name)}</span>
                        ))}
                        {assigned.length > 3 && <span className="text-xs text-tx-muted">+{assigned.length-3}</span>}
                      </div>
                    ) : <span className="text-xs text-tx-muted italic">Aucun</span>}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${ev.status==="actif"?"bg-success-soft text-success":"bg-surface-alt text-tx-muted"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${ev.status==="actif"?"bg-success":"bg-tx-muted"}`}/>
                      {ev.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={()=>openEdit(ev)} title="Modifier" className="p-1.5 rounded-lg hover:bg-primary-soft text-tx-muted hover:text-primary transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={()=>doToggle(ev)} title={ev.status==="actif"?"Désactiver":"Activer"} className="p-1.5 rounded-lg hover:bg-warn-soft text-tx-muted hover:text-warn transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10"/></svg>
                      </button>
                      <button onClick={()=>setModal({kind:"delete",ev})} title="Supprimer" className="p-1.5 rounded-lg hover:bg-danger-soft text-tx-muted hover:text-danger transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal === "create" && <FormModal title="Nouvel évaluateur" onSave={save} />}
      {modal && typeof modal==="object" && modal.kind==="edit" && <FormModal title="Modifier l'évaluateur" onSave={save} />}
      {modal && typeof modal==="object" && modal.kind==="delete" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h2 className="text-base font-bold text-tx mb-2">Supprimer l'évaluateur</h2>
            <p className="text-sm text-tx-muted mb-6">Voulez-vous supprimer <strong>{modal.ev.name}</strong> ? Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button onClick={()=>setModal(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt">Annuler</button>
              <button onClick={()=>doDelete(modal.ev)} disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-danger text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {loading ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
