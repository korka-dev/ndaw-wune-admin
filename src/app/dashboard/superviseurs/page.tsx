"use client";
import { useEffect, useRef, useState } from "react";
import { superviseursApi, schoolsApi, teachersApi } from "@/lib/api";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

interface Superviseur {
  id: string; name: string; phone?: string; title?: string;
  status: string; school_id?: string; assigned_teacher_ids?: string[];
}
interface School  { id: string; name: string; }
interface Teacher { id: string; name: string; phone?: string; school_id?: string; classes?: string[]; }

const EMPTY = { name:"", phone:"", title:"", school_id:"", assigned_teacher_ids:[] as string[] };
type ModalState = null | "create"
  | { kind:"view";   sup:Superviseur }
  | { kind:"manage"; sup:Superviseur }
  | { kind:"toggle"; sup:Superviseur }
  | { kind:"edit";   sup:Superviseur }
  | { kind:"delete"; sup:Superviseur }
  | { kind:"assign"; sup:Superviseur };

const cls = "w-full border border-border rounded-xl px-3.5 py-2.5 text-sm bg-bg text-tx outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors";

export default function SuperviseursPage() {
  const [sups,     setSups]     = useState<Superviseur[]>([]);
  const [schools,  setSchools]  = useState<School[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [modal,    setModal]    = useState<ModalState>(null);
  const [form,     setForm]     = useState<typeof EMPTY>(EMPTY);
  const [loading,      setLoading]      = useState(false);
  const [phoneError,   setPhoneError]   = useState("");
  const [search,       setSearch]       = useState("");
  const [filterSchool, setFilterSchool] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  /* état modal assignation */
  const [assignIds,    setAssignIds]    = useState<string[]>([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [page,         setPage]         = useState(1);

  /* auto-focus premier champ à l'ouverture du modal */
  const firstFieldRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (modal === "create" || (modal && typeof modal === "object" && (modal.kind === "edit"))) {
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    }
  }, [modal]);

  const load = () => {
    superviseursApi.list().then(r => setSups(r.data.items ?? [])).catch(() => {});
    schoolsApi.list({ limit: 10000 }).then(r => setSchools(r.data.items ?? [])).catch(() => {});
    teachersApi.list({ limit: 10000 }).then(r => setTeachers(r.data.items ?? [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  /* Vérification unicité téléphone : superviseurs + enseignants */
  const checkPhone = (phone: string, excludeId?: string) => {
    const t = phone.trim();
    if (!t) { setPhoneError(""); return; }
    const dupSup     = sups.find(s => s.phone?.trim() === t && s.id !== excludeId);
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
      } else if (modal && typeof modal === "object" && modal.kind === "edit") {
        await superviseursApi.update(modal.sup.id, form);
      }
      load(); setModal(null);
    } finally { setLoading(false); }
  };

  const doDelete = async (sup: Superviseur) => {
    setLoading(true);
    try { await superviseursApi.delete(sup.id); load(); setModal(null); }
    finally { setLoading(false); }
  };

  const doToggle = async (sup: Superviseur) => {
    setLoading(true);
    try { await superviseursApi.toggleStatus(sup.id); load(); closeModal(); }
    finally { setLoading(false); }
  };

  const toggleTeacher = (id: string) =>
    setForm(f => ({
      ...f,
      assigned_teacher_ids: f.assigned_teacher_ids.includes(id)
        ? f.assigned_teacher_ids.filter(x => x !== id)
        : [...f.assigned_teacher_ids, id],
    }));

  /* Naviguer au champ suivant avec Entrée */
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, nextId?: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (nextId) (document.getElementById(nextId) as HTMLElement | null)?.focus();
      else save();
    }
  };

  const initials    = (n: string) => n.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  const schoolName  = (id?: string) => schools.find(s => s.id === id)?.name ?? "—";
  const schoolTeachers  = (sid: string) => teachers.filter(t => t.school_id === sid);
  const assignedTeachers = (ids?: string[]) => teachers.filter(t => ids?.includes(t.id));

  /* Réinitialiser la page quand les filtres changent */
  useEffect(() => { setPage(1); }, [search, filterSchool, filterStatus]);

  const hasFilters = !!(search || filterSchool || filterStatus);
  const filtered = sups.filter(s => {
    const matchSearch = !search.trim() ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      schoolName(s.school_id).toLowerCase().includes(search.toLowerCase());
    const matchSchool = !filterSchool || s.school_id === filterSchool;
    const matchStatus = !filterStatus || s.status === filterStatus;
    return matchSearch && matchSchool && matchStatus;
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => { setForm(EMPTY); setPhoneError(""); setModal("create"); };
  const openEdit   = (sup: Superviseur) => {
    setForm({ name:sup.name, phone:sup.phone??"", title:sup.title??"",
      school_id:sup.school_id??"", assigned_teacher_ids:sup.assigned_teacher_ids??[] });
    setPhoneError("");
    setModal({ kind:"edit", sup });
  };
  const openAssign = (sup: Superviseur) => {
    setAssignIds(sup.assigned_teacher_ids ?? []);
    setAssignSearch("");
    setModal({ kind:"assign", sup });
  };
  const toggleAssignId = (id: string) =>
    setAssignIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const saveAssign = async (sup: Superviseur) => {
    setLoading(true);
    try { await superviseursApi.assignTeachers(sup.id, assignIds); load(); closeModal(); }
    finally { setLoading(false); }
  };
  const closeModal = () => setModal(null);

  const isFormOpen = modal === "create" || (modal !== null && typeof modal === "object" && (modal as any).kind === "edit");
  const formTitle  = modal === "create" ? "Nouveau superviseur" : "Modifier le superviseur";
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
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Ajouter
        </button>
      </div>

      {/* ── Barre de recherche + filtres ── */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un superviseur…"
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"/>
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tx-muted hover:text-tx">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M5 10v6c0 2 3 4 7 4s7-2 7-4v-6"/>
          </svg>
          <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)}
            className={`pl-8 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none min-w-[170px] ${filterSchool ? "border-brand text-brand font-medium" : "border-border text-tx"}`}>
            <option value="">Toutes les écoles</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none"><path d="M6 9l6 6 6-6"/></svg>
        </div>

        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
          </svg>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className={`pl-8 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none min-w-[140px] ${filterStatus ? "border-brand text-brand font-medium" : "border-border text-tx"}`}>
            <option value="">Tous les statuts</option>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none"><path d="M6 9l6 6 6-6"/></svg>
        </div>

        {hasFilters && (
          <button onClick={() => { setSearch(""); setFilterSchool(""); setFilterStatus(""); }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-brand/30 bg-brand-soft text-brand text-sm font-medium hover:bg-brand hover:text-white transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            Réinitialiser
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden flex-1">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[24%]"/><col className="w-[16%]"/><col className="w-[22%]"/><col className="w-[18%]"/><col className="w-[10%]"/><col className="w-[10%]"/>
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              {["Superviseur","Contact","École","Profs assignés","Statut","Actions"].map(h => (
                <th key={h} className="px-5 py-3 text-center text-xs font-semibold text-tx-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-tx-muted text-sm">
                {hasFilters ? "Aucun superviseur ne correspond aux filtres." : "Aucun superviseur pour l'instant."}
              </td></tr>
            )}
            {paginated.map(sup => {
              const assigned = assignedTeachers(sup.assigned_teacher_ids);
              return (
                <tr key={sup.id} onClick={() => setModal({ kind:"view", sup })}
                  className="border-t border-border hover:bg-surface-alt transition-colors cursor-pointer">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-brand-soft text-brand flex items-center justify-center text-xs font-bold flex-shrink-0">{initials(sup.name)}</div>
                      <div>
                        <div className="font-medium text-tx">{sup.name}</div>
                        {sup.title && <div className="text-xs text-tx-muted">{sup.title}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-tx-muted text-center text-xs">{sup.phone ?? "—"}</td>
                  <td className="px-5 py-3.5 text-tx-muted text-center text-xs">{schoolName(sup.school_id)}</td>
                  <td className="px-5 py-3.5 text-center">
                    {assigned.length > 0 ? (
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {assigned.slice(0, 3).map(t => (
                          <span key={t.id} title={t.name}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-soft text-primary text-[9px] font-bold">
                            {initials(t.name)}
                          </span>
                        ))}
                        {assigned.length > 3 && <span className="text-xs text-tx-muted">+{assigned.length - 3}</span>}
                      </div>
                    ) : <span className="text-xs text-tx-muted italic">Aucun</span>}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${sup.status === "actif" ? "bg-success-soft text-success" : "bg-surface-alt text-tx-muted"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sup.status === "actif" ? "bg-success" : "bg-tx-muted"}`}/>
                      {sup.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setModal({ kind:"manage", sup })}
                      className="text-xs bg-primary-soft text-primary px-3 py-1.5 rounded-lg font-medium hover:bg-primary hover:text-white transition-colors">
                      Gérer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-5 pb-4">
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
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${modal.sup.status === "actif" ? "bg-success" : "bg-tx-muted"}`}/>
                  {modal.sup.status === "actif" ? "Actif" : "Inactif"}
                  {modal.sup.school_id && (
                    <><span className="text-border">·</span>{schoolName(modal.sup.school_id)}</>
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
                  <circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-4 3.5-6 7-6s7 2 7 6"/>
                  <path d="M19 8v6M16 11h6"/>
                </svg>
                Assigner des enseignants
                {(modal.sup.assigned_teacher_ids ?? []).length > 0 && (
                  <span className="ml-auto text-xs bg-brand text-white font-bold px-2 py-0.5 rounded-full">
                    {(modal.sup.assigned_teacher_ids ?? []).length}
                  </span>
                )}
              </button>

              {/* Modifier */}
              <button
                onClick={() => { const s = modal.sup; closeModal(); setTimeout(() => openEdit(s), 30); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-alt hover:bg-primary-soft text-tx hover:text-primary text-sm font-medium transition-colors text-left">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Modifier le superviseur
              </button>

              {/* Activer / Désactiver */}
              <button
                onClick={() => setModal({ kind:"toggle", sup: modal.sup })}
                disabled={loading}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left disabled:opacity-60
                  ${modal.sup.status === "actif"
                    ? "bg-surface-alt hover:bg-warn-soft text-tx hover:text-warn"
                    : "bg-surface-alt hover:bg-success-soft text-tx hover:text-success"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18.36 6.64a9 9 0 11-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
                </svg>
                {modal.sup.status === "actif" ? "Désactiver le superviseur" : "Activer le superviseur"}
              </button>

              {/* Supprimer */}
              <button
                onClick={() => { const s = modal.sup; closeModal(); setTimeout(() => setModal({ kind:"delete", sup:s }), 30); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-alt hover:bg-danger-soft text-tx hover:text-danger text-sm font-medium transition-colors text-left">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>
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
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
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
                  onChange={e => setForm(f => ({ ...f, school_id: e.target.value, assigned_teacher_ids: [] }))}
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
                      ({form.assigned_teacher_ids.length} sélectionné{form.assigned_teacher_ids.length !== 1 ? "s" : ""})
                    </span>
                  </label>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                    {schoolTeachers(form.school_id).length === 0 ? (
                      <p className="text-sm text-tx-muted italic py-2 text-center">Aucun enseignant dans cette école</p>
                    ) : schoolTeachers(form.school_id).map(t => {
                      const sel = form.assigned_teacher_ids.includes(t.id);
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
                            {sel && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
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
                  <span className={`w-1.5 h-1.5 rounded-full ${modal.sup.status === "actif" ? "bg-success" : "bg-tx-muted"}`}/>
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
                    <path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013.09 4.18 2 2 0 015.09 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L9.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
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
                    <path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M5 10v6c0 2 3 4 7 4s7-2 7-4v-6"/>
                  </svg>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-tx-muted uppercase tracking-wide">École</div>
                  <div className="text-sm text-tx font-medium">{schoolName(modal.sup.school_id)}</div>
                </div>
              </div>

              {/* Enseignants supervisés */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-alt flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-tx-muted">
                    <circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-4 3.5-6 7-6s7 2 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M22 19c0-2.8-2-4.5-5-4.5"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold text-tx-muted uppercase tracking-wide mb-1.5">
                    Enseignants supervisés ({(modal.sup.assigned_teacher_ids ?? []).length})
                  </div>
                  {assignedTeachers(modal.sup.assigned_teacher_ids).length === 0 ? (
                    <p className="text-sm text-tx-muted italic">Aucun enseignant assigné</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {assignedTeachers(modal.sup.assigned_teacher_ids).map(t => (
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
              <button onClick={() => setModal({ kind:"manage", sup: modal.sup })}
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
                  <path d="M18.36 6.64a9 9 0 11-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
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
          schoolName(t.school_id).toLowerCase().includes(assignSearch.toLowerCase())
        );
        const allSelected = display.length > 0 && display.every(t => assignIds.includes(t.id));
        const toggleAll   = () => setAssignIds(allSelected ? [] : display.map(t => t.id));
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

              {/* En-tête */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-base font-bold text-tx">Enseignants assignés</h2>
                  <p className="text-xs text-tx-muted mt-0.5">{sup.name} · {schoolName(sup.school_id)}</p>
                </div>
                <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-lg text-tx-muted hover:text-tx hover:bg-surface-alt transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>
                </button>
              </div>

              {/* Recherche + compteur + tout sélectionner */}
              <div className="px-6 pt-4 pb-3 flex-shrink-0 space-y-3">
                <div className="relative">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
                    <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <input value={assignSearch} onChange={e => setAssignSearch(e.target.value)}
                    placeholder="Rechercher un enseignant…"
                    className="w-full bg-bg border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"/>
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
                        {sel && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
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
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12l5 5 9-11"/></svg>Enregistrer ({assignIds.length})</>
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
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
