"use client";
import { useEffect, useRef, useState } from "react";
import { classesApi, schoolsApi } from "@/lib/api";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 25;
const NIVEAUX = ["CP", "CE1", "CE2", "CM1", "CM2"] as const;

interface SchoolClasse {
  id: string;
  name: string;
  niveau: string;
  effectif?: number;
  school_id: string;
  school?: { id: string; name: string };
}
interface School { id: string; name: string; }

const EMPTY_FORM = { name: "", niveau: "CP", school_id: "", effectif: "" };

type ModalState =
  | null
  | "create"
  | { kind: "edit";   classe: SchoolClasse }
  | { kind: "delete"; classe: SchoolClasse };

// Génère les classes disponibles pour un niveau : CP A, CP B, CP C
function classesForNiveau(niv: string): string[] {
  return ["A", "B", "C", "D"].map(l => `${niv} ${l}`);
}

export default function ClassesPage() {
  const [classes, setClasses]   = useState<SchoolClasse[]>([]);
  const [schools, setSchools]   = useState<School[]>([]);
  const [modal, setModal]       = useState<ModalState>(null);
  const [form, setForm]         = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [loading, setLoading]   = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [filterSchool, setFilterSchool] = useState("");
  const [filterNiveau, setFilterNiveau] = useState("");
  const [search, setSearch]     = useState("");
  const [page, setPage]         = useState(1);
  const [importingXlsx,  setImportingXlsx]  = useState(false);
  const [xlsxResult,     setXlsxResult]     = useState<{ imported: number; skipped: number; schools_created: number; errors: string[] } | null>(null);
  const [xlsxError,      setXlsxError]      = useState<string | null>(null);
  const importXlsxRef = useRef<HTMLInputElement>(null);

  const handleImportXlsx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingXlsx(true);
    setXlsxResult(null);
    setXlsxError(null);
    try {
      const res = await classesApi.importXlsx(file);
      setXlsxResult(res.data);
      load();
    } catch (err: any) {
      setXlsxError(err?.response?.data?.detail ?? "Erreur lors de l'import Excel.");
    } finally {
      setImportingXlsx(false);
      if (importXlsxRef.current) importXlsxRef.current.value = "";
    }
  };

  const load = () => {
    classesApi.list({ limit: 500 }).then(r => setClasses(r.data.items ?? [])).catch(() => {});
    schoolsApi.list().then(r => setSchools(r.data.items ?? [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [search, filterSchool, filterNiveau]);

  const hasFilters = !!(search || filterSchool || filterNiveau);

  const filtered = classes.filter(c => {
    const matchSearch = !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.school?.name.toLowerCase().includes(search.toLowerCase());
    const matchSchool = !filterSchool || c.school_id === filterSchool;
    const matchNiveau = !filterNiveau || c.niveau === filterNiveau;
    return matchSearch && matchSchool && matchNiveau;
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Grouper pour l'affichage par école
  const schoolMap = Object.fromEntries(schools.map(s => [s.id, s.name]));

  const save = async () => {
    setSaveError(null);
    if (!form.name.trim()) { setSaveError("Le nom de la classe est requis."); return; }
    if (!form.school_id)   { setSaveError("Veuillez sélectionner une école."); return; }
    setLoading(true);
    try {
      const payload = {
        name:      form.name.trim(),
        niveau:    form.niveau,
        school_id: form.school_id,
        effectif:  form.effectif ? parseInt(form.effectif) : undefined,
      };
      if (modal === "create") {
        await classesApi.create(payload);
      } else if (modal && typeof modal === "object" && modal.kind === "edit") {
        await classesApi.update(modal.classe.id, { name: payload.name, niveau: payload.niveau, effectif: payload.effectif });
      }
      load();
      setModal(null);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setSaveError(Array.isArray(detail) ? detail.map((e: any) => e.msg).join(" · ") : (detail ?? "Une erreur est survenue."));
    } finally { setLoading(false); }
  };

  const doDelete = async (c: SchoolClasse) => {
    setLoading(true);
    try { await classesApi.delete(c.id); load(); setModal(null); }
    catch (err: any) { setSaveError(err?.response?.data?.detail ?? "Erreur lors de la suppression."); }
    finally { setLoading(false); }
  };

  // Niveau badge color
  const niveauColor = (niv: string) => {
    const map: Record<string, string> = {
      CP:  "bg-purple-100 text-purple-700",
      CE1: "bg-blue-100 text-blue-700",
      CE2: "bg-cyan-100 text-cyan-700",
      CM1: "bg-orange-100 text-orange-700",
      CM2: "bg-rose-100 text-rose-700",
    };
    return map[niv] ?? "bg-surface-alt text-tx-muted";
  };

  return (
    <div className="flex flex-col min-h-full px-7 pb-7">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Gestion Classes</h1>
          <p className="text-tx-muted text-sm mt-0.5">
            {hasFilters
              ? `${filtered.length} résultat${filtered.length !== 1 ? "s" : ""} sur ${classes.length} classe${classes.length !== 1 ? "s" : ""}`
              : `${classes.length} classe${classes.length !== 1 ? "s" : ""} au total · Page ${page}/${Math.ceil(filtered.length / PAGE_SIZE) || 1}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => importXlsxRef.current?.click()}
            disabled={importingXlsx}
            title="Importer les classes depuis un fichier Excel liste-élèves (colonnes SCHOOL, NIVEAU, Classe)"
            className="flex items-center gap-2 bg-success-soft border border-success/30 hover:bg-success/10 text-success px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {importingXlsx ? "Import…" : "Importer Excel"}
          </button>
          <input ref={importXlsxRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportXlsx} />
          <button
            onClick={() => { setForm(EMPTY_FORM); setSaveError(null); setModal("create"); }}
            className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Ajouter une classe
          </button>
        </div>
      </div>

      {/* ── Filtres ── */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {/* Recherche */}
        <div className="relative flex-1 min-w-[200px]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom de classe ou école…"
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tx-muted hover:text-tx">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        {/* Filtre École */}
        <div className="relative">
          <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)}
            className={`pl-3 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 transition appearance-none min-w-[180px] ${filterSchool ? "border-brand text-brand font-medium" : "border-border text-tx"}`}>
            <option value="">Toutes les écoles</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none"><path d="M6 9l6 6 6-6" /></svg>
        </div>
        {/* Filtre Niveau */}
        <div className="relative">
          <select value={filterNiveau} onChange={e => setFilterNiveau(e.target.value)}
            className={`pl-3 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 transition appearance-none min-w-[130px] ${filterNiveau ? "border-brand text-brand font-medium" : "border-border text-tx"}`}>
            <option value="">Tous les niveaux</option>
            {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none"><path d="M6 9l6 6 6-6" /></svg>
        </div>
        {hasFilters && (
          <button onClick={() => { setSearch(""); setFilterSchool(""); setFilterNiveau(""); }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-brand/30 bg-brand-soft text-brand text-sm font-medium hover:bg-brand hover:text-white transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            Réinitialiser
          </button>
        )}
      </div>

      {/* ── Tableau ── */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden flex-1">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[14%]" />
            <col className="w-[35%]" />
            <col className="w-[16%]" />
            <col className="w-[15%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              {["Classe", "Niveau", "École", "Effectif", "Actions"].map(h => (
                <th key={h} className="px-5 py-3 text-center text-xs font-semibold text-tx-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map(c => (
              <tr key={c.id} className="border-t border-border hover:bg-surface-alt transition-colors">
                <td className="px-5 py-3.5 text-center">
                  <span className="font-semibold text-tx">{c.name}</span>
                </td>
                <td className="px-5 py-3.5 text-center">
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${niveauColor(c.niveau)}`}>{c.niveau}</span>
                </td>
                <td className="px-5 py-3.5 text-tx-muted text-center">{c.school?.name ?? schoolMap[c.school_id] ?? "—"}</td>
                <td className="px-5 py-3.5 text-center text-tx-muted">
                  {c.effectif != null ? (
                    <span className="font-medium text-tx">{c.effectif}</span>
                  ) : "—"}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => { setForm({ name: c.name, niveau: c.niveau, school_id: c.school_id, effectif: c.effectif?.toString() ?? "" }); setSaveError(null); setModal({ kind: "edit", classe: c }); }}
                      className="text-xs bg-primary-soft text-primary px-3 py-1 rounded-lg font-medium hover:bg-primary hover:text-white transition-colors"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => setModal({ kind: "delete", classe: c })}
                      className="text-xs bg-danger-soft text-danger px-3 py-1 rounded-lg font-medium hover:bg-danger hover:text-white transition-colors"
                    >
                      Suppr.
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-tx-muted text-sm">
                  {hasFilters ? "Aucune classe ne correspond aux filtres." : "Aucune classe pour l'instant. Commencez par en ajouter une."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="pb-4 px-5">
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      {/* ── Modal Créer / Modifier ── */}
      {(modal === "create" || (modal && typeof modal === "object" && modal.kind === "edit")) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
          onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-base font-bold text-tx mb-5">
              {modal === "create" ? "Ajouter une classe" : "Modifier la classe"}
            </h2>

            {saveError && (
              <div className="mb-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-danger-soft border border-danger/20 text-danger text-sm">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{saveError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* École (création seulement) */}
              {modal === "create" && (
                <div>
                  <label className="block text-sm font-medium text-tx mb-1">
                    École <span className="text-danger">*</span>
                  </label>
                  <select value={form.school_id} onChange={e => setForm(f => ({ ...f, school_id: e.target.value }))}
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition">
                    <option value="">— Sélectionner une école —</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {/* Niveau */}
              <div>
                <label className="block text-sm font-medium text-tx mb-2">
                  Niveau <span className="text-danger">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {NIVEAUX.map(niv => (
                    <button key={niv} type="button"
                      onClick={() => setForm(f => ({ ...f, niveau: niv, name: "" }))}
                      className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-colors ${form.niveau === niv
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-border bg-surface-alt text-tx hover:border-brand/40"}`}>
                      {niv}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nom de la classe */}
              <div>
                <label className="block text-sm font-medium text-tx mb-2">
                  Classe <span className="text-danger">*</span>
                </label>
                {/* Suggestions rapides */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {classesForNiveau(form.niveau).map(cls => (
                    <button key={cls} type="button"
                      onClick={() => setForm(f => ({ ...f, name: cls }))}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${form.name === cls
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-border bg-surface-alt text-tx hover:border-brand/40"}`}>
                      {cls}
                    </button>
                  ))}
                </div>
                {/* Ou saisie libre */}
                <input type="text" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={`Ex : ${form.niveau} A`}
                  className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition" />
                <p className="text-xs text-tx-muted mt-1">Cliquez sur une suggestion ou saisissez librement.</p>
              </div>

              {/* Effectif (optionnel) */}
              <div>
                <label className="block text-sm font-medium text-tx mb-1">Effectif <span className="text-tx-muted font-normal">(optionnel)</span></label>
                <input type="number" min="0" max="999" value={form.effectif}
                  onChange={e => setForm(f => ({ ...f, effectif: e.target.value }))}
                  placeholder="Ex : 32"
                  className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition" />
              </div>
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setModal(null)}
                className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">
                Annuler
              </button>
              <button onClick={save} disabled={loading}
                className="px-5 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {loading ? "Enregistrement…" : (modal === "create" ? "Ajouter" : "Enregistrer")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Supprimer ── */}
      {modal && typeof modal === "object" && modal.kind === "delete" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-danger-soft flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-tx">Supprimer la classe</h2>
                <p className="text-sm text-tx-muted mt-1">
                  Supprimer <span className="font-semibold text-tx">{modal.classe.name}</span>
                  {modal.classe.school && <> de <span className="font-semibold text-tx">{modal.classe.school.name}</span></>} ?
                  Cette action est irréversible.
                </p>
              </div>
            </div>
            {saveError && (
              <p className="mb-4 text-sm text-danger bg-danger-soft px-3 py-2 rounded-xl">{saveError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setModal(null); setSaveError(null); }}
                className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">
                Annuler
              </button>
              <button onClick={() => doDelete(modal.classe)} disabled={loading}
                className="px-4 py-2 rounded-xl bg-danger hover:bg-danger/90 text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {loading ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale résultat import Excel ── */}
      {(xlsxResult || xlsxError) && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setXlsxResult(null); setXlsxError(null); }}>
          <div className="bg-surface rounded-2xl shadow-xl p-7 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-tx mb-4">Import Excel — Résultat</h2>
            {xlsxError ? (
              <p className="text-danger text-sm mb-5">{xlsxError}</p>
            ) : xlsxResult && (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-success-soft rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-success">{xlsxResult.imported}</p>
                    <p className="text-[11px] text-tx-muted mt-1">Classe(s) créée(s)</p>
                  </div>
                  <div className="bg-surface-alt rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-tx-muted">{xlsxResult.skipped}</p>
                    <p className="text-[11px] text-tx-muted mt-1">Existante(s)</p>
                  </div>
                  <div className="bg-warn-soft rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-warn">{xlsxResult.schools_created}</p>
                    <p className="text-[11px] text-tx-muted mt-1">École(s) créée(s)</p>
                  </div>
                </div>
                {xlsxResult.errors?.length > 0 && (
                  <div className="bg-danger-soft rounded-xl p-3 mb-4 text-xs text-danger max-h-28 overflow-y-auto">
                    {xlsxResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                  </div>
                )}
              </>
            )}
            <button onClick={() => { setXlsxResult(null); setXlsxError(null); }} className="w-full bg-brand hover:bg-brand-dark text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
