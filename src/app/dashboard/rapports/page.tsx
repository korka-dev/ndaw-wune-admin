"use client";
import { useEffect, useState } from "react";
import { rapportsApi, sessionsApi, teachersApi } from "@/lib/api";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

interface Rapport { id:string; seance_id:string; teacher_id:string; contenu:string; difficultes?:string; points_positifs?:string; soumis_en_offline:boolean; created_at:string; }

export default function RapportsPage() {
  const [items,    setItems]    = useState<Rapport[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [sessId,   setSessId]   = useState("");
  const [teachId,  setTeachId]  = useState("");
  const [detail,   setDetail]   = useState<Rapport|null>(null);
  const [page,     setPage]     = useState(1);

  useEffect(() => {
    sessionsApi.list().then(r=>setSessions(r.data.items??[])).catch(()=>{});
    teachersApi.list({ limit: 10000 }).then(r=>setTeachers(r.data.items??[])).catch(()=>{});
  }, []);

  useEffect(() => {
    rapportsApi.list({ session_id: sessId||undefined, teacher_id: teachId||undefined })
      .then(r=>setItems(r.data.items??[])).catch(()=>{});
  }, [sessId, teachId]);

  const teacher = (id:string) => teachers.find(t=>t.id===id)?.name ?? id.slice(0,8);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Rapports enseignants</h1>

      <div className="flex gap-3 mb-4">
        <select value={sessId} onChange={e=>{ setSessId(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Toutes les sessions</option>
          {sessions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={teachId} onChange={e=>{ setTeachId(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Tous les enseignants</option>
          {teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="bg-surface rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>{["Enseignant","Date","Offline","Actions"].map(h=>(
              <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {items.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE).map(r=>(
              <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{teacher(r.teacher_id)}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(r.created_at).toLocaleDateString("fr")}</td>
                <td className="px-4 py-3">
                  {r.soumis_en_offline
                    ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Offline</span>
                    : <span className="text-xs text-gray-400">Online</span>}
                </td>
                <td className="px-4 py-3">
                  <button onClick={()=>setDetail(r)} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100">Voir</button>
                </td>
              </tr>
            ))}
            {items.length===0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Aucun rapport</td></tr>}
          </tbody>
        </table>
        <div className="px-5 pb-4">
          <Pagination page={page} total={items.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-4">Rapport — {teacher(detail.teacher_id)}</h2>
            <div className="space-y-4 text-sm">
              <div><div className="font-medium text-gray-700 mb-1">Contenu</div><p className="text-gray-600 whitespace-pre-wrap">{detail.contenu}</p></div>
              {detail.points_positifs && <div><div className="font-medium text-gray-700 mb-1">Points positifs</div><p className="text-gray-600">{detail.points_positifs}</p></div>}
              {detail.difficultes && <div><div className="font-medium text-gray-700 mb-1">Difficultés</div><p className="text-gray-600">{detail.difficultes}</p></div>}
            </div>
            <button onClick={()=>setDetail(null)} className="mt-5 w-full border rounded-lg py-2 text-sm hover:bg-gray-50">Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}
