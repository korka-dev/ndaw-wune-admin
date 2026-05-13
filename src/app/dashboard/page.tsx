"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { sessionsApi, teachersApi, schoolsApi, rapportsApi, planningApi } from "@/lib/api";

/* ── Types ── */
interface Stats {
  schools: number; schoolRegions: number;
  teachers: number;
  students: number;
  regions: number; totalRegions: number;
  seancesDone: number; seancesTotal: number; seancesMissed: number; seancesUpcoming: number;
  completion: number;
  activeSession: { name: string; dateDebut: string; dateFin: string } | null;
  ecolesByRegion:   { label: string; value: number }[];
  seancesByMonth:   { m: string; v: number }[];
  teachersBySchool: { label: string; value: number }[];
  planningByDay:    { label: string; value: number }[];
}

const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const BAR_COLORS = ["#8B6F1F","#4A90C2","#2F7D4A","#C68B1A","#7B4F9E"];

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/* ── SVG Line chart ── */
function LineChart({ data, color }: { data:{m:string;v:number}[]; color:string }) {
  const W=440,H=130,ML=32,MB=20,MT=8,MR=8;
  const pw=W-ML-MR, ph=H-MT-MB;
  const maxV = Math.ceil(Math.max(...data.map(d=>d.v))/50)*50||1;
  const pts = data.map((d,i)=>({ x:ML+(i/(data.length-1))*pw, y:MT+(1-d.v/maxV)*ph, m:d.m, v:d.v }));
  const lineD = pts.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${lineD} L${pts[pts.length-1].x.toFixed(1)} ${MT+ph} L${ML} ${MT+ph} Z`;
  const grid = [0, Math.round(maxV/2), maxV];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full block">
      {grid.map(v=>{ const y=MT+(1-v/maxV)*ph; return (
        <g key={v}>
          <line x1={ML} y1={y.toFixed(1)} x2={W-MR} y2={y.toFixed(1)} stroke="#EFE7D2" strokeWidth="1" strokeDasharray={v===0?"":"3 3"}/>
          <text x={ML-4} y={(y+4).toFixed(1)} textAnchor="end" fontSize="9" fill="#9C8E73">{v}</text>
        </g>
      ); })}
      <path d={areaD} fill={color} opacity="0.1"/>
      <path d={lineD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {pts.map((p,i)=>(
        <g key={i}>
          <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="4" fill={color} stroke="#fff" strokeWidth="2"/>
          <text x={p.x.toFixed(1)} y={(MT+ph+15).toFixed(1)} textAnchor="middle" fontSize="9" fill="#6E624A">{p.m}</text>
        </g>
      ))}
    </svg>
  );
}

/* ── SVG Donut chart ── */
function DonutChart({ done, missed, upcoming }: { done:number; missed:number; upcoming:number }) {
  const total = done + missed + upcoming || 1;
  const segs = [
    { v:done,     color:"#2F7D4A" },
    { v:missed,   color:"#B23A3A" },
    { v:upcoming, color:"#4A90C2" },
  ];
  const R=46, r=30, cx=60, cy=60;
  let angle = -Math.PI/2;
  const paths = segs.map(s=>{
    if(s.v===0) return null;
    const a = (s.v/total)*2*Math.PI;
    const ea= angle+a;
    const la= a>Math.PI?1:0;
    const x1=cx+R*Math.cos(angle), y1=cy+R*Math.sin(angle);
    const x2=cx+R*Math.cos(ea),    y2=cy+R*Math.sin(ea);
    const ix1=cx+r*Math.cos(ea),   iy1=cy+r*Math.sin(ea);
    const ix2=cx+r*Math.cos(angle),iy2=cy+r*Math.sin(angle);
    const d=`M${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R},0,${la},1,${x2.toFixed(1)},${y2.toFixed(1)} L${ix1.toFixed(1)},${iy1.toFixed(1)} A${r},${r},0,${la},0,${ix2.toFixed(1)},${iy2.toFixed(1)} Z`;
    angle=ea;
    return { d, color:s.color };
  });
  return (
    <svg viewBox="0 0 120 120" className="w-32 h-32 flex-shrink-0">
      {paths.map((p,i)=> p && <path key={i} d={p.d} fill={p.color}/>)}
      <text x={cx} y={cy-4} textAnchor="middle" fontSize="18" fontWeight="700" fill="#1F1A10">{done+missed+upcoming}</text>
      <text x={cx} y={cy+12} textAnchor="middle" fontSize="9" fill="#6E624A">total</text>
    </svg>
  );
}

/* ── Horizontal bar ── */
function HBar({ label, value, max, color }: { label:string; value:number; max:number; color:string }) {
  const pct = max ? Math.round(value/max*100) : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-24 text-right text-tx-muted truncate">{label}</span>
      <div className="flex-1 bg-surface-alt rounded-full h-6 overflow-hidden">
        <div className="h-full rounded-full flex items-center px-2 transition-all" style={{ width:`${Math.max(pct,value>0?8:0)}%`, background:color }}>
          <span className="text-white font-bold text-[11px]">{value}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Stat card ── */
function StatCard({ icon, label, value, sub, iconBg, iconColor }: any) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-2 min-h-[116px]">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: icon }}/>
      </div>
      <div className="text-2xl font-bold text-tx leading-none">{value}</div>
      <div>
        <div className="text-xs font-medium text-tx">{label}</div>
        {sub && <div className="text-[11px] text-tx-muted mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

/* ── Page ── */
export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Partial<Stats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      sessionsApi.list(),
      teachersApi.list(),
      schoolsApi.list(),
      rapportsApi.list({ limit: 200 }),
      planningApi.list(),
    ]).then(([sr, tr, scr, rr, pr]) => {
      const sessions = sr.status==="fulfilled" ? (sr.value.data.items ?? []) : [];
      const teachers = tr.status==="fulfilled" ? (tr.value.data.items ?? []) : [];
      const schools  = scr.status==="fulfilled" ? (scr.value.data.items ?? []) : [];
      const rapports = rr.status==="fulfilled" ? (rr.value.data.items ?? []) : [];
      const segs     = pr.status==="fulfilled" ? (pr.value.data.items ?? []) : [];

      /* ── Stats de base ── */
      const active    = sessions.find((s:any) => s.status==="active");
      const students  = schools.reduce((a:number,s:any) => a + (s.students ?? 0), 0);
      const regionSet = new Set(schools.map((s:any) => s.region).filter(Boolean));

      const ecolesByRegion = Array.from(
        schools.reduce((m:Map<string,number>,s:any) => {
          const r = s.region ?? "—"; m.set(r, (m.get(r) ?? 0) + 1); return m;
        }, new Map<string,number>())
      ).map(([label,value]) => ({ label, value })).sort((a,b) => b.value-a.value);

      /* Séances via rapports */
      const total      = rapports.length;
      const done       = total;
      const completion = 100;

      /* ── Chart 1 : séances réalisées par mois ── */
      const monthMap = new Map<string,number>();
      rapports.forEach((r:any) => {
        const d = new Date(r.created_at);
        const key = `${MONTHS_FR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
        monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
      });
      // Générer les 6 derniers mois (avec 0 si pas de données)
      const now = new Date();
      const seancesByMonth = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        const key = `${MONTHS_FR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
        return { m: key, v: monthMap.get(key) ?? 0 };
      });

      /* ── Chart 2 : enseignants par école ── */
      const schoolMap = new Map<string,number>();
      teachers.forEach((t:any) => {
        const school = schools.find((s:any) => s.id === t.school_id);
        const key = school?.name ?? "Sans école";
        schoolMap.set(key, (schoolMap.get(key) ?? 0) + 1);
      });
      const teachersBySchool = Array.from(schoolMap)
        .map(([label,value]) => ({ label, value }))
        .sort((a,b) => b.value - a.value)
        .slice(0, 5);

      /* ── Chart 3 : durée planning par jour (en minutes) ── */
      const JOURS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
      const durByDay = new Array(6).fill(0);
      segs.forEach((seg:any) => {
        if (seg.jour >= 0 && seg.jour < 6) {
          durByDay[seg.jour] += toMinutes(seg.heure_fin) - toMinutes(seg.heure_debut);
        }
      });
      const planningByDay = JOURS
        .map((label, i) => ({ label, value: durByDay[i] }))
        .filter(d => d.value > 0);

      setStats({
        schools: schools.length, schoolRegions: regionSet.size,
        teachers: teachers.filter((t:any) => t.status==="actif").length || teachers.length,
        students, regions: regionSet.size, totalRegions: 14,
        seancesDone: done, seancesTotal: total, seancesMissed: 0,
        seancesUpcoming: 0,
        completion,
        activeSession: active ? { name:active.name, dateDebut:active.date_debut, dateFin:active.date_fin } : null,
        ecolesByRegion,
        seancesByMonth,
        teachersBySchool,
        planningByDay,
      });
      setLoading(false);
    });
  }, []);

  const s = stats;
  const regionMax = Math.max(...(s.ecolesByRegion??[]).map(r=>r.value),1);

  return (
    <div className="flex flex-col flex-1">
      {/* Session banner */}
      {s.activeSession && (
        <div className="sticky top-0 z-10 bg-brand text-white px-7 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span className="font-medium">Session active :</span>
            <span className="font-bold">{s.activeSession.name}</span>
            <span className="text-white/70">{s.activeSession.dateDebut} → {s.activeSession.dateFin}</span>
          </div>
          <div className="flex gap-2">
            {[
              { label:"Importer", icon:"M12 15V3M6 9l6-6 6 6M4 21h16" },
              { label:"Exporter", icon:"M12 3v12M18 15l-6 6-6-6M4 21h16", primary:true },
            ].map(b=>(
              <button key={b.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${b.primary?"bg-white text-brand hover:bg-white/90":"bg-white/20 hover:bg-white/30"}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d={b.icon}/></svg>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-7 flex-1">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-tx">Tableau de bord</h1>
          <p className="text-tx-muted text-sm mt-0.5">Vue d'ensemble du programme ARED · Ndangwune</p>
        </div>

        {/* Stats row 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard label="Écoles"          value={loading?"—":s.schools}   sub={`${s.schoolRegions ?? "—"} régions`}       iconBg="bg-success-soft"  iconColor="#2F7D4A" icon='<path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M5 10v6c0 2 3 4 7 4s7-2 7-4v-6"/>'/>
          <StatCard label="Enseignants"     value={loading?"—":s.teachers}  sub="actifs"                                     iconBg="bg-primary-soft"  iconColor="#4A90C2" icon='<circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-4 3.5-6 7-6s7 2 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M22 19c0-2.8-2-4.5-5-4.5"/>'/>
          <StatCard label="Élèves suivis"   value={loading?"—":(s.students||"—")} sub="total programme"                    iconBg="bg-success-soft"  iconColor="#2F7D4A" icon='<circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-4 3.5-6 7-6s7 2 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M22 19c0-2.8-2-4.5-5-4.5"/>'/>
          <StatCard label="Régions couvertes" value={loading?"—":s.regions} sub={`sur ${s.totalRegions ?? 14}`}            iconBg="bg-warn-soft"     iconColor="#C68B1A" icon='<path d="M12 22s7-7 7-13a7 7 0 10-14 0c0 6 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/>'/>
        </div>

        {/* Stats row 2 */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard label="Séances réalisées"  value={loading?"—":s.seancesDone}  sub={`${s.seancesTotal ?? "—"} total`}  iconBg="bg-success-soft"  iconColor="#2F7D4A" icon='<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'/>
          <StatCard label="Taux de complétion" value={loading?"—":`${s.completion}%`} sub={`${s.seancesMissed ?? "—"} manquées`} iconBg="bg-warn-soft" iconColor="#C68B1A" icon='<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'/>
          <StatCard label="Séances réalisées (total)" value={loading?"—":s.seancesTotal} sub="tous rapports"           iconBg="bg-purple-soft"   iconColor="#7B4F9E" icon='<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>'/>
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Line chart — séances réalisées par mois */}
          <div className="col-span-2 bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-tx">Séances réalisées par mois</div>
              <div className="text-xs text-tx-muted">6 derniers mois</div>
            </div>
            {(s.seancesByMonth ?? []).some(d => d.v > 0)
              ? <LineChart data={s.seancesByMonth ?? []} color="#4A90C2" />
              : <div className="flex items-center justify-center h-24 text-xs text-tx-muted">Aucune séance enregistrée</div>
            }
          </div>

          {/* Donut chart */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-tx">Suivi des séances</div>
              <a href="/dashboard/suivi-seances" className="text-xs text-brand font-semibold hover:underline">Détail →</a>
            </div>
            <div className="flex items-center gap-4">
              <DonutChart
                done={s.seancesDone??0}
                missed={s.seancesMissed??0}
                upcoming={s.seancesUpcoming??0}
              />
              <div className="space-y-2 text-xs">
                {[
                  { label:"Réalisées", value:s.seancesDone??0,      color:"bg-success" },
                  { label:"Manquées",  value:s.seancesMissed??0,    color:"bg-danger"  },
                  { label:"À venir",   value:s.seancesUpcoming??0,  color:"bg-primary" },
                ].map(l=>(
                  <div key={l.label} className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${l.color} flex-shrink-0`}/>
                    <span className="text-tx-muted">{l.label}</span>
                    <span className="font-bold text-tx ml-auto">{l.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-3 gap-4">
          {/* Écoles par région */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-tx">Écoles par région</div>
              <a href="/dashboard/ecoles" className="text-xs text-brand font-semibold hover:underline">Voir →</a>
            </div>
            <div className="space-y-2.5">
              {(s.ecolesByRegion??[]).slice(0,5).map((r,i)=>(
                <HBar key={r.label} label={r.label} value={r.value} max={regionMax}
                  color={["#8B6F1F","#4A90C2","#2F7D4A","#C68B1A","#7B4F9E"][i%5]}/>
              ))}
              {!s.ecolesByRegion?.length && <p className="text-xs text-tx-dim text-center py-4">Aucune donnée</p>}
            </div>
          </div>

          {/* Enseignants par école */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-tx">Enseignants par école</div>
              <a href="/dashboard/teachers" className="text-xs text-brand font-semibold hover:underline">Voir →</a>
            </div>
            <div className="space-y-2.5">
              {(s.teachersBySchool ?? []).length > 0
                ? (s.teachersBySchool ?? []).map((r, i) => (
                    <HBar key={r.label} label={r.label} value={r.value}
                      max={Math.max(...(s.teachersBySchool ?? []).map(x => x.value), 1)}
                      color={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))
                : <p className="text-xs text-tx-muted text-center py-4">Aucune donnée</p>
              }
            </div>
          </div>

          {/* Durée planning / jour */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-tx">Durée planning / jour</div>
              <a href="/dashboard/planning" className="text-xs text-brand font-semibold hover:underline">Voir →</a>
            </div>
            <div className="space-y-2.5">
              {(s.planningByDay ?? []).length > 0
                ? (s.planningByDay ?? []).map((d, i) => (
                    <HBar key={d.label} label={d.label} value={d.value}
                      max={Math.max(...(s.planningByDay ?? []).map(x => x.value), 1)}
                      color={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))
                : <p className="text-xs text-tx-muted text-center py-4">Aucun créneau planifié</p>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
