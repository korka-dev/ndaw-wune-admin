"use client";
import { useEffect, useState } from "react";
import { elevesApi, schoolsApi, sessionsApi } from "@/lib/api";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

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
}
interface School  { id: string; name: string; }
interface Session { id: string; name: string; status: string; }

const EMPTY_FORM = {
  nom: "", prenom: "", genre: "", date_naissance: "", classe: "", school_id: "", session_id: "",
};

type ModalState =
  | null
  | "create"
  | { kind: "view";   eleve: Eleve }
  | { kind: "edit";   eleve: Eleve }
  | { kind: "delete"; eleve: Eleve };

export default function ElevesPage() {
  const [eleves,        setEleves]        = useState<Eleve[]>([]);
  const [schools,       setSchools]       = useState<School[]>([]);
  const [sessions,      setSessions]      = useState<Session[]>([]);
  const [modal,         setModal]         = useState<ModalState>(null);
  const [form,          setForm]          = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [loading,       setLoading]       = useState(false);
  const [search,        setSearch]        = useState("");
  const [filterSchool,  setFilterSchool]  = useState("");
  const [filterClasse,  setFilterClasse]  = useState("");
  const [filterSession, setFilterSession] = useState("");
  const [filterGenre,   setFilterGenre]   = useState("");
  const [page,          setPage]          = useState(1);

  const load = () => {
    elevesApi.list().then(r => setEleves(r.data.items ?? [])).catch(() => {});
    schoolsApi.list().then(r => setSchools(r.data.items ?? [])).catch(() => {});
    sessionsApi.list().then(r => setSessions(r.data.items ?? [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [search, filterSchool, filterClasse, filterSession, filterGenre]);

  // Valeurs uniques de classe extraites des élèves
  const uniqueClasses = Array.from(new Set(eleves.map(e => e.classe).filter(Boolean) as string[])).sort();

  const hasFilters = !!(search || filterSchool || filterClasse || filterSession || filterGenre);

  const filtered = eleves.filter(e => {
    const fullName = `${e.nom} ${e.prenom ?? ""}`.toLowerCase();
    const matchSearch  = !search.trim() || fullName.includes(search.toLowerCase());
    const matchSchool  = !filterSchool  || e.school_id  === filterSchool;
    const matchClasse  = !filterClasse  || e.classe     === filterClasse;
    const matchSession = !filterSession || e.session_id === filterSession;
    const matchGenre   = !filterGenre   || e.genre      === filterGenre;
    return matchSearch && matchSchool && matchClasse && matchSession && matchGenre;
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => { setForm(EMPTY_FORM); setModal("create"); };
  const openEdit   = (eleve: Eleve) => {
    setForm({
      nom:            eleve.nom           ?? "",
      prenom:         eleve.prenom        ?? "",
      genre:          eleve.genre         ?? "",
      date_naissance: eleve.date_naissance ?? "",
      classe:         eleve.classe        ?? "",
      school_id:      eleve.school_id     ?? "",
      session_id:     eleve.session_id    ?? "",
    });
    setModal({ kind: "edit", eleve });
  };

  const save = async () => {
    if (!form.nom.trim()) return;
    setLoading(true);
    try {
      if (modal === "create") {
        await elevesApi.create(form);
      } else if (modal && typeof modal === "object" && modal.kind === "edit") {
        await elevesApi.update(modal.eleve.id, form);
      }
      load();
      setModal(null);
    } finally {
      setLoading(false);
    }
  };

  const doDelete = async (eleve: Eleve) => {
    setLoading(true);
    try { await elevesApi.delete(eleve.id); load(); setModal(null); }
    finally { setLoading(false); }
  };

  const schoolName   = (id?: string) => schools.find(s => s.id === id)?.name ?? "—";
  const sessionName  = (id?: string) => sessions.find(s => s.id === id)?.name ?? "—";
  const genreLabel   = (g?: string) => g === "Masculin" ? "M" : g === "Féminin" ? "F" : "—";
  const fullName     = (e: Eleve)   => [e.nom, e.prenom].filter(Boolean).join(" ");
  const initials     = (e: Eleve)   => [e.nom?.[0], e.prenom?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  // ── Form fields shared between create/edit ──────────────────────────────────
  const FormFields = () => (
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
          <label className="block text-sm font-medium text-tx mb-1">Genre</label>
          <select
            value={form.genre}
            onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
            className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition"
          >
            <option value="">— Sélectionner —</option>
            <option value="Masculin">Masculin</option>
            <option value="Féminin">Féminin</option>
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

      <div>
        <label className="block text-sm font-medium text-tx mb-1">Classe</label>
        <input
          type="text" value={form.classe}
          onChange={e => setForm(f => ({ ...f, classe: e.target.value }))}
          placeholder="CE1, CM2…"
          className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition"
        />
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

  return (
    <div className="flex flex-col min-h-full px-7 pb-7">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Gestion Élèves</h1>
          <p className="text-tx-muted text-sm mt-0.5">
            {hasFilters
              ? `${filtered.length} résultat${filtered.length !== 1 ? "s" : ""} sur ${eleves.length} élève${eleves.length !== 1 ? "s" : ""} · Page ${page}/${Math.ceil(filtered.length / PAGE_SIZE) || 1}`
              : `${eleves.length} élève${eleves.length !== 1 ? "s" : ""} au total · Page ${page}/${Math.ceil(eleves.length / PAGE_SIZE) || 1}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Ajouter
          </button>
        </div>
      </div>

      {/* ── Filtres ── */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {/* Recherche */}
        <div className="relative flex-1 min-w-[200px]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou prénom…"
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tx-muted hover:text-tx">
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
          <select
            value={filterSchool} onChange={e => setFilterSchool(e.target.value)}
            className={`pl-8 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none min-w-[160px] ${
              filterSchool ? "border-brand text-brand font-medium" : "border-border text-tx"
            }`}
          >
            <option value="">Toutes les écoles</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>

        {/* Filtre Classe */}
        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
          </svg>
          <select
            value={filterClasse} onChange={e => setFilterClasse(e.target.value)}
            className={`pl-8 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none min-w-[140px] ${
              filterClasse ? "border-brand text-brand font-medium" : "border-border text-tx"
            }`}
          >
            <option value="">Toutes les classes</option>
            {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>

        {/* Filtre Session */}
        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <select
            value={filterSession} onChange={e => setFilterSession(e.target.value)}
            className={`pl-8 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none min-w-[150px] ${
              filterSession ? "border-brand text-brand font-medium" : "border-border text-tx"
            }`}
          >
            <option value="">Toutes les sessions</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>

        {/* Filtre Genre */}
        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <circle cx="12" cy="8" r="4"/><path d="M12 12v8M9 18h6"/>
          </svg>
          <select
            value={filterGenre} onChange={e => setFilterGenre(e.target.value)}
            className={`pl-8 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none min-w-[130px] ${
              filterGenre ? "border-brand text-brand font-medium" : "border-border text-tx"
            }`}
          >
            <option value="">Tous les genres</option>
            <option value="Masculin">Masculin</option>
            <option value="Féminin">Féminin</option>
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>

        {/* Reset */}
        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setFilterSchool(""); setFilterClasse(""); setFilterSession(""); setFilterGenre(""); }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-brand/30 bg-brand-soft text-brand text-sm font-medium hover:bg-brand hover:text-white transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            Réinitialiser
          </button>
        )}
      </div>

      {/* ── Tableau ── */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden flex-1">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[22%]"/>
            <col className="w-[8%]"/>
            <col className="w-[10%]"/>
            <col className="w-[18%]"/>
            <col className="w-[16%]"/>
            <col className="w-[12%]"/>
            <col className="w-[14%]"/>
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              {["Élève", "Genre", "Classe", "École", "Session", "Statut", "Actions"].map(h => (
                <th key={h} className="px-5 py-3 text-center text-xs font-semibold text-tx-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map(e => (
              <tr
                key={e.id}
                onClick={() => setModal({ kind: "view", eleve: e })}
                className="border-t border-border hover:bg-surface-alt transition-colors cursor-pointer"
              >
                {/* Élève */}
                <td className="px-5 py-3.5 text-center">
                  <div className="flex items-center justify-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary-soft text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {initials(e)}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-tx">{e.nom}</div>
                      {e.prenom && <div className="text-xs text-tx-muted">{e.prenom}</div>}
                    </div>
                  </div>
                </td>
                {/* Genre */}
                <td className="px-5 py-3.5 text-center">
                  {e.genre ? (
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      e.genre === "Masculin" ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-600"
                    }`}>
                      {genreLabel(e.genre)}
                    </span>
                  ) : <span className="text-tx-muted">—</span>}
                </td>
                {/* Classe */}
                <td className="px-5 py-3.5 text-center">
                  {e.classe
                    ? <span className="bg-primary-soft text-primary text-xs font-bold px-2 py-0.5 rounded-md">{e.classe}</span>
                    : <span className="text-tx-muted">—</span>}
                </td>
                {/* École */}
                <td className="px-5 py-3.5 text-tx-muted text-center truncate">{schoolName(e.school_id)}</td>
                {/* Session */}
                <td className="px-5 py-3.5 text-tx-muted text-center truncate">{sessionName(e.session_id)}</td>
                {/* Statut */}
                <td className="px-5 py-3.5 text-center">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    e.statut === "actif" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${e.statut === "actif" ? "bg-success" : "bg-danger"}`}/>
                    {e.statut}
                  </span>
                </td>
                {/* Actions */}
                <td className="px-5 py-3.5" onClick={ev => ev.stopPropagation()}>
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => openEdit(e)}
                      className="text-xs bg-primary-soft text-primary px-3 py-1 rounded-lg font-medium hover:bg-primary hover:text-white transition-colors"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => setModal({ kind: "delete", eleve: e })}
                      className="text-xs bg-danger-soft text-danger px-3 py-1 rounded-lg font-medium hover:bg-danger hover:text-white transition-colors"
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center text-tx-muted text-sm">
                  {hasFilters ? "Aucun élève ne correspond aux filtres." : "Aucun élève pour l'instant."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="pb-4 px-5">
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      {/* ── Modal Vue détail ── */}
      {modal && typeof modal === "object" && modal.kind === "view" && (() => {
        const e = modal.eleve;
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
            onClick={ev => { if (ev.target === ev.currentTarget) setModal(null); }}>
            <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm">
              {/* En-tête */}
              <div className="bg-primary-soft rounded-t-2xl px-6 pt-6 pb-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                  {initials(e)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-tx text-base truncate">{fullName(e)}</div>
                  {e.classe && <div className="text-xs text-tx-muted mt-0.5">Classe : {e.classe}</div>}
                  <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    e.statut === "actif" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${e.statut === "actif" ? "bg-success" : "bg-danger"}`}/>
                    {e.statut}
                  </span>
                </div>
              </div>
              {/* Infos */}
              <div className="px-6 py-4 space-y-3">
                {[
                  { label: "Genre",            value: e.genre ?? "—" },
                  { label: "Date de naissance", value: e.date_naissance ? new Date(e.date_naissance).toLocaleDateString("fr-FR") : "—" },
                  { label: "École",            value: schoolName(e.school_id) },
                  { label: "Session",          value: sessionName(e.session_id) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-tx-muted">{label}</span>
                    <span className="font-medium text-tx">{value}</span>
                  </div>
                ))}
              </div>
              {/* Actions */}
              <div className="px-6 pb-5 flex gap-3">
                <button onClick={() => setModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors">
                  Fermer
                </button>
                <button onClick={() => openEdit(e)}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                  Modifier
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal Créer ── */}
      {modal === "create" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
          onClick={ev => { if (ev.target === ev.currentTarget) setModal(null); }}>
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-tx mb-5">Nouvel élève</h2>
            <FormFields />
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setModal(null)}
                className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">
                Annuler
              </button>
              <button onClick={save} disabled={loading || !form.nom.trim()}
                className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {loading ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Modifier ── */}
      {modal && typeof modal === "object" && modal.kind === "edit" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
          onClick={ev => { if (ev.target === ev.currentTarget) setModal(null); }}>
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-tx mb-5">Modifier l'élève</h2>
            <FormFields />
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setModal(null)}
                className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">
                Annuler
              </button>
              <button onClick={save} disabled={loading || !form.nom.trim()}
                className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {loading ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Suppression ── */}
      {modal && typeof modal === "object" && modal.kind === "delete" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-danger-soft flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-tx">Supprimer l'élève</h2>
                <p className="text-sm text-tx-muted mt-1">
                  Êtes-vous sûr de vouloir supprimer{" "}
                  <span className="font-semibold text-tx">{fullName(modal.eleve)}</span> ?
                  Cette action est irréversible.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setModal(null)}
                className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">
                Annuler
              </button>
              <button onClick={() => doDelete(modal.eleve)} disabled={loading}
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
