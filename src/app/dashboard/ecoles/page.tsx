"use client";
import { useEffect, useRef, useState } from "react";
import { schoolsApi, exportApi } from "@/lib/api";
import { downloadBlob } from "@/lib/csv";
import Pagination from "@/components/Pagination";

interface School {
  id:             string;
  name:           string;
  region:         string | null;
  city:           string | null;
  director:       string | null;
  director_phone: string | null;
}

const EMPTY: Omit<School, "id"> = { name: "", region: "", city: "", director: "", director_phone: "" };
const PAGE_SIZE = 9;

const SchoolIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B6F1F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M5 10v6c0 2 3 4 7 4s7-2 7-4v-6"/>
  </svg>
);

export default function EcolesPage() {
  const [schools,  setSchools]  = useState<School[]>([]);
  const [modal,    setModal]    = useState<null | "create" | "view" | School>(null);
  const [viewData, setViewData] = useState<School | null>(null);
  const [form,     setForm]     = useState<typeof EMPTY>(EMPTY);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [search,       setSearch]       = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterCity,   setFilterCity]   = useState("");
  const [page,         setPage]         = useState(1);
  const [exporting,    setExporting]    = useState(false);
  const [importMsg,    setImportMsg]    = useState<{ ok: boolean; text: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const load = () =>
    schoolsApi.list()
      .then(r => setSchools(r.data.items ?? []))
      .catch(() => {});

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [search, filterRegion, filterCity]);

  const regions = Array.from(
    new Set(schools.map(s => s.region).filter(Boolean))
  ) as string[];

  const cities = Array.from(
    new Set(schools.map(s => s.city).filter(Boolean))
  ) as string[];

  const filtered = schools.filter(s => {
    const matchSearch = [s.name, s.region, s.city, s.director].some(v =>
      v?.toLowerCase().includes(search.toLowerCase())
    );
    const matchRegion = !filterRegion || s.region === filterRegion;
    const matchCity   = !filterCity   || s.city   === filterCity;
    return matchSearch && matchRegion && matchCity;
  });
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const checkPhone = (phone: string, excludeId?: string) => {
    const trimmed = phone.trim();
    if (!trimmed) { setPhoneError(""); return; }
    const duplicate = schools.find(s =>
      s.director_phone?.trim() === trimmed && s.id !== excludeId
    );
    setPhoneError(
      duplicate
        ? `Ce numéro est déjà utilisé par l'école « ${duplicate.name} ».`
        : ""
    );
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportApi.schools();
      downloadBlob(res.data, "ecoles.csv");
    } catch { /* silencieux */ }
    finally { setExporting(false); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await schoolsApi.importCsv(file);
      const count = res.data?.imported ?? res.data?.count ?? "?";
      setImportMsg({ ok: true, text: `${count} école${count !== 1 ? "s" : ""} importée${count !== 1 ? "s" : ""} avec succès.` });
      load();
    } catch (err: any) {
      setImportMsg({ ok: false, text: err?.response?.data?.detail ?? "Erreur lors de l'import." });
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const openCreate = () => { setForm(EMPTY); setError(""); setPhoneError(""); setModal("create"); };
  const openEdit   = (s: School) => {
    setForm({ name: s.name, region: s.region ?? "", city: s.city ?? "", director: s.director ?? "", director_phone: s.director_phone ?? "" });
    setError(""); setPhoneError("");
    setModal(s);
  };
  const openView = (s: School) => { setViewData(s); setModal("view"); };

  const save = async () => {
    if (!form.name.trim()) { setError("Le nom est obligatoire."); return; }
    if (phoneError) return;
    setLoading(true); setError("");
    try {
      const payload = {
        name:           form.name.trim(),
        region:         form.region?.trim()         || null,
        city:           form.city?.trim()           || null,
        director:       form.director?.trim()       || null,
        director_phone: form.director_phone?.trim() || null,
      };
      if (modal === "create") await schoolsApi.create(payload);
      else await schoolsApi.update((modal as School).id, payload);
      await load(); setModal(null);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Une erreur est survenue.");
    } finally { setLoading(false); }
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer cette école ? Les enseignants rattachés seront détachés.")) return;
    try { await schoolsApi.delete(id); await load(); }
    catch (e: any) { alert(e?.response?.data?.detail ?? "Suppression impossible."); }
  };

  const isFormModal = modal === "create" || (modal !== null && modal !== "view" && typeof modal === "object");

  return (
    <div className="px-7 pb-7">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-5 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Gestion Écoles</h1>
          <p className="text-tx-muted text-sm mt-0.5">
            {(search || filterRegion || filterCity)
              ? `${filtered.length} résultat${filtered.length > 1 ? "s" : ""} sur ${schools.length} école${schools.length > 1 ? "s" : ""}`
              : `${schools.length} école${schools.length > 1 ? "s" : ""} au total`}
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
          <div className="relative">
            <button
              onClick={() => importRef.current?.click()}
              title={`Format attendu : name,region,city,director,director_phone`}
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
          {/* Nouvelle école */}
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Nouvelle école
          </button>
        </div>
      </div>

      {/* Barre de recherche + filtres */}
      <div className="flex gap-3 mb-5">
        {/* Recherche */}
        <div className="relative flex-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, région, ville, directeur…"
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tx-muted hover:text-tx">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {/* Filtre Région */}
        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1118 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <select
            value={filterRegion}
            onChange={e => setFilterRegion(e.target.value)}
            className={`pl-8 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none min-w-[160px] ${
              filterRegion ? "border-brand text-brand font-medium" : "border-border text-tx"
            }`}
          >
            <option value="">Toutes les régions</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>

        {/* Filtre Ville */}
        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <select
            value={filterCity}
            onChange={e => { setFilterCity(e.target.value); setPage(1); }}
            className={`pl-8 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition appearance-none min-w-[140px] ${
              filterCity ? "border-brand text-brand font-medium" : "border-border text-tx"
            }`}
          >
            <option value="">Toutes les villes</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>

        {/* Reset filtres actifs */}
        {(filterRegion || filterCity) && (
          <button
            onClick={() => { setFilterRegion(""); setFilterCity(""); setPage(1); }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-brand/30 bg-brand-soft text-brand text-sm font-medium hover:bg-brand hover:text-white transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            Réinitialiser
          </button>
        )}
      </div>

      {/* Grille */}
      {paginated.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-12 text-center">
          <div className="w-14 h-14 bg-brand-soft rounded-2xl flex items-center justify-center mx-auto mb-4">
            <SchoolIcon />
          </div>
          <p className="text-tx-muted text-sm mb-3">
            {(search || filterRegion || filterCity) ? "Aucune école ne correspond aux filtres." : "Aucune école enregistrée."}
          </p>
          {!(search || filterRegion || filterCity) && (
            <button onClick={openCreate} className="text-brand text-sm font-medium hover:underline">
              Créer la première école →
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
            {paginated.map(s => (
              <div key={s.id}
                onClick={() => openView(s)}
                className="bg-surface rounded-2xl border border-border p-5 flex flex-col gap-3 hover:shadow-md hover:border-brand/30 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-soft flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <SchoolIcon />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-tx leading-snug truncate group-hover:text-brand transition-colors">{s.name}</h2>
                    {(s.city || s.region) && (
                      <p className="text-xs text-tx-muted mt-0.5 truncate">
                        {[s.city, s.region].filter(Boolean).join(" — ")}
                      </p>
                    )}
                  </div>
                </div>

                {s.director && (
                  <div className="text-xs text-tx-muted flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6"/></svg>
                    <span className="truncate">{s.director}</span>
                  </div>
                )}

                <div className="flex gap-2 mt-auto pt-3 border-t border-border" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openEdit(s)}
                    className="flex-1 text-xs bg-primary-soft text-primary py-1.5 rounded-lg hover:bg-primary hover:text-white font-medium transition-colors">
                    Modifier
                  </button>
                  <button onClick={() => del(s.id)}
                    className="flex-1 text-xs bg-danger-soft text-danger py-1.5 rounded-lg hover:bg-danger hover:text-white font-medium transition-colors">
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
      )}

      {/* ── Modal détail (vue) ── */}
      {modal === "view" && viewData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-brand-soft flex items-center justify-center flex-shrink-0">
                <SchoolIcon />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-tx truncate">{viewData.name}</h2>
                {(viewData.city || viewData.region) && (
                  <p className="text-xs text-tx-muted mt-0.5">{[viewData.city, viewData.region].filter(Boolean).join(" — ")}</p>
                )}
              </div>
            </div>

            <div className="space-y-3 bg-surface-alt rounded-xl p-4">
              {[
                { label: "Région",    value: viewData.region },
                { label: "Ville",     value: viewData.city },
                { label: "Directeur(trice)", value: viewData.director },
                { label: "N° Directeur(trice)", value: viewData.director_phone },
              ].map(({ label, value }) => value ? (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-tx-muted">{label}</span>
                  <span className="font-medium text-tx">{value}</span>
                </div>
              ) : null)}
              {!viewData.region && !viewData.city && !viewData.director && !viewData.director_phone && (
                <p className="text-xs text-tx-muted text-center">Aucune information complémentaire</p>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">
                Fermer
              </button>
              <button onClick={() => { setModal(null); setTimeout(() => openEdit(viewData), 50); }}
                className="flex-1 py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition-colors">
                Modifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal création / édition ── */}
      {isFormModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-base font-bold text-tx mb-5">
              {modal === "create" ? "Nouvelle école" : "Modifier l'école"}
            </h2>

            {error && (
              <div className="bg-danger-soft text-danger rounded-xl px-4 py-2.5 text-sm mb-4 flex gap-2 items-start">
                <span>⚠</span><span>{error}</span>
              </div>
            )}

            <div className="space-y-3">
              {([
                ["Nom de l'école *",       "name",           "École primaire de …"],
                ["Région",                  "region",         "Dakar, Thiès, …"],
                ["Ville / Commune",         "city",           "Dakar, Rufisque, …"],
                ["Directeur(trice)",        "director",       "Prénom NOM"],
                ["N° du Directeur(trice)",  "director_phone", "77 000 00 00"],
              ] as [string, keyof typeof EMPTY, string][]).map(([label, key, placeholder]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-tx mb-1">{label}</label>
                  <input
                    type={key === "director_phone" ? "tel" : "text"}
                    value={(form[key] as string) ?? ""}
                    onChange={e => {
                      const val = e.target.value;
                      setForm(f => ({ ...f, [key]: val }));
                      if (key === "director_phone") {
                        const excludeId = modal !== "create" ? (modal as School).id : undefined;
                        checkPhone(val, excludeId);
                      }
                    }}
                    placeholder={placeholder}
                    className={`w-full bg-surface-alt border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 transition ${
                      key === "director_phone" && phoneError
                        ? "border-danger focus:ring-danger/30 focus:border-danger/40"
                        : "border-border focus:ring-brand/30 focus:border-brand/40"
                    }`}
                  />
                  {key === "director_phone" && phoneError && (
                    <p className="mt-1.5 text-xs text-danger flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {phoneError}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setModal(null)}
                className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">
                Annuler
              </button>
              <button onClick={save} disabled={loading || !!phoneError}
                className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
                {loading ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
