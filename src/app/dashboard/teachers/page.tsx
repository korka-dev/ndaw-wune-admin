"use client";
import { useEffect, useState } from "react";
import { teachersApi, schoolsApi } from "@/lib/api";

interface Teacher { id:string; name:string; email?:string; phone?:string; title?:string; status:string; school_id?:string; classes?:string[]; }
interface School  { id:string; name:string; }
const EMPTY_T = { name:"", email:"", phone:"", title:"", school_id:"", classes:[] as string[] };

type ModalState = null | "create" | { kind:"edit"; teacher:Teacher } | { kind:"manage"; teacher:Teacher } | { kind:"delete"; teacher:Teacher };

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schools,  setSchools]  = useState<School[]>([]);
  const [modal,    setModal]    = useState<ModalState>(null);
  const [form,     setForm]     = useState<typeof EMPTY_T>(EMPTY_T);
  const [loading,  setLoading]  = useState(false);

  const load = () => {
    teachersApi.list().then(r=>setTeachers(r.data.items??[])).catch(()=>{});
    schoolsApi.list().then(r=>setSchools(r.data.items??[])).catch(()=>{});
  };
  useEffect(()=>{ load(); },[]);

  const save = async () => {
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
          <p className="text-tx-muted text-sm mt-0.5">{teachers.length} enseignant{teachers.length!==1?"s":""} au total</p>
        </div>
        <button onClick={()=>{ setForm(EMPTY_T); setModal("create"); }}
          className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Ajouter
        </button>
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
            {teachers.map(t=>{
              const school=schools.find(s=>s.id===t.school_id);
              return (
                <tr key={t.id} className="border-t border-border hover:bg-surface-alt transition-colors">
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
                  <td className="px-5 py-3.5 text-tx-muted text-center">{t.email??t.phone??"—"}</td>
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
                  <td className="px-5 py-3.5">
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
            {teachers.length===0 && (
              <tr><td colSpan={6} className="px-5 py-16 text-center text-tx-muted text-sm">Aucun enseignant pour l'instant</td></tr>
            )}
          </tbody>
        </table>
      </div>

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
                onClick={()=>{ const t=modal.teacher; setModal({kind:"edit",teacher:t}); setForm({...EMPTY_T,...t}); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-alt hover:bg-primary-soft text-tx hover:text-primary text-sm font-medium transition-colors text-left">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Modifier l'enseignant
              </button>
              <button
                onClick={()=>doToggle(modal.teacher)}
                disabled={loading}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left disabled:opacity-60 ${modal.teacher.status==="actif"?"bg-surface-alt hover:bg-warn-soft text-tx hover:text-warn":"bg-surface-alt hover:bg-success-soft text-tx hover:text-success"}`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>
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
              {([["Nom complet","name"],["Titre (optionnel)","title"],["E-mail","email"],["Téléphone","phone"]] as [string,string][]).map(([l,k])=>(
                <div key={k}>
                  <label className="block text-sm font-medium text-tx mb-1">{l}</label>
                  <input type="text" value={(form as any)[k]??""}
                    onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition"/>
                </div>
              ))}
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
              <button onClick={save} disabled={loading} className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-60 transition-colors">
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
              {([["Nom complet","name"],["Titre (optionnel)","title"],["E-mail","email"],["Téléphone","phone"]] as [string,string][]).map(([l,k])=>(
                <div key={k}>
                  <label className="block text-sm font-medium text-tx mb-1">{l}</label>
                  <input type="text" value={(form as any)[k]??""}
                    onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition"/>
                </div>
              ))}
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
              <button onClick={save} disabled={loading} className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-60 transition-colors">
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
