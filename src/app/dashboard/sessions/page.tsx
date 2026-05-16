"use client";
import { useEffect, useState } from "react";
import { sessionsApi } from "@/lib/api";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

interface Session { id:string; name:string; date_debut:string; date_fin:string; status:string; description?:string; }
const EMPTY: Omit<Session,"id"> = { name:"", date_debut:"", date_fin:"", status:"inactive", description:"" };

function StatusBadge({ status }: { status:string }) {
  return status === "active"
    ? <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success-soft text-success"><span className="w-1.5 h-1.5 rounded-full bg-success"/>Active</span>
    : <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-alt text-tx-muted"><span className="w-1.5 h-1.5 rounded-full bg-tx-muted/40"/>Inactive</span>;
}

export default function SessionsPage() {
  const [items,   setItems]   = useState<Session[]>([]);
  const [modal,   setModal]   = useState<null|"create"|Session>(null);
  const [form,    setForm]    = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [page,    setPage]    = useState(1);

  const load = () => sessionsApi.list().then(r => setItems(r.data.items ?? [])).catch(()=>{});
  useEffect(() => { load(); }, []);

  const paginated = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const save = async () => {
    setLoading(true);
    try {
      if (modal==="create") await sessionsApi.create(form);
      else await sessionsApi.update((modal as Session).id, form);
      await load(); setModal(null);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col min-h-full px-7 pb-7">
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Gestion Sessions</h1>
          <p className="text-tx-muted text-sm mt-0.5">{items.length} session{items.length!==1?"s":""} au total</p>
        </div>
        <button onClick={()=>{ setForm(EMPTY); setModal("create"); }}
          className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Nouvelle session
        </button>
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden flex-1">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[35%]"/>
            <col className="w-[15%]"/>
            <col className="w-[15%]"/>
            <col className="w-[15%]"/>
            <col className="w-[20%]"/>
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              {["Nom","Début","Fin","Statut","Actions"].map(h=>(
                <th key={h} className="px-5 py-3 text-center text-xs font-semibold text-tx-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map(s=>(
              <tr key={s.id} className="border-t border-border hover:bg-surface-alt transition-colors">
                <td className="px-5 py-3.5 font-medium text-tx text-center">{s.name}</td>
                <td className="px-5 py-3.5 text-tx-muted text-center">{s.date_debut}</td>
                <td className="px-5 py-3.5 text-tx-muted text-center">{s.date_fin}</td>
                <td className="px-5 py-3.5 text-center"><StatusBadge status={s.status}/></td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-2 justify-center">
                    {s.status !== "active" && (
                      <button onClick={()=>{ sessionsApi.activate(s.id).then(load); }}
                        className="text-xs bg-success-soft text-success px-2.5 py-1 rounded-lg font-medium hover:bg-success hover:text-white transition-colors">
                        Activer
                      </button>
                    )}
                    {s.status === "active" && (
                      <button onClick={()=>{ sessionsApi.deactivate(s.id).then(load); }}
                        className="text-xs bg-warn-soft text-warn px-2.5 py-1 rounded-lg font-medium hover:bg-warn hover:text-white transition-colors">
                        Désactiver
                      </button>
                    )}
                    <button onClick={()=>{ setForm(s); setModal(s); }}
                      className="text-xs bg-primary-soft text-primary px-2.5 py-1 rounded-lg font-medium hover:bg-primary hover:text-white transition-colors">
                      Modifier
                    </button>
                    <button onClick={()=>{ if(!confirm("Supprimer cette session ?")) return; sessionsApi.delete(s.id).then(load); }}
                      className="text-xs bg-danger-soft text-danger px-2.5 py-1 rounded-lg font-medium hover:bg-danger hover:text-white transition-colors">
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length===0 && (
              <tr><td colSpan={5} className="px-5 py-16 text-center text-tx-muted text-sm">Aucune session pour l'instant</td></tr>
            )}
          </tbody>
        </table>
        <div className="pb-4 px-5">
          <Pagination page={page} total={items.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-base font-bold text-tx mb-5">{modal==="create"?"Nouvelle session":"Modifier la session"}</h2>
            <div className="space-y-3">
              {[["Nom de la session","name","text"],["Date de début","date_debut","date"],["Date de fin","date_fin","date"]].map(([l,k,t])=>(
                <div key={k}>
                  <label className="block text-sm font-medium text-tx mb-1">{l}</label>
                  <input type={t} value={(form as any)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"/>
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-tx mb-1">Description</label>
                <textarea value={form.description??""} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                  className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition" rows={3}/>
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
    </div>
  );
}
