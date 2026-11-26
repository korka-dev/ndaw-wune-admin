"use client";
import { useEffect, useState } from "react";
import { inspecteursApi } from "@/lib/api";
import Pagination from "@/components/Pagination";
import ImportPointsFocaux from "@/components/ImportPointsFocaux";
import { useArchive, ArchiveNotice, ShowArchivedToggle, ArchivedBadge, RestoreButton, ArchiveConsequences } from "@/components/ArchiveControls";

/*
 * Lot L8 — comptes inspecteurs (IEF).
 * L'inspecteur se connecte à l'application mobile avec son téléphone et consulte
 * en lecture seule les écoles de son IEF. Cette page ne gère que ses comptes.
 * La réinitialisation du mot de passe passe par la page « Identifiants ».
 */

const PAGE_SIZE = 20;

interface Inspecteur {
  id: string; name: string; email?: string | null; phone?: string | null; title?: string | null;
  status: string; ief?: string | null; must_change_password?: boolean;
  archived_at?: string | null;
}
interface IefOption { ief: string; nb_ecoles: number; }

const EMPTY = { name: "", phone: "", email: "", title: "", ief: "" };
type ModalState = null | "create" | { kind: "edit"; insp: Inspecteur } | { kind: "delete"; insp: Inspecteur };

/** Extrait le message d'erreur du serveur (detail texte ou liste de validation FastAPI). */
function messageErreur(e: unknown, defaut: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const msgs = detail.map(d => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : "")).filter(Boolean);
    if (msgs.length) return msgs.join(" · ");
  }
  return defaut;
}

export default function InspecteursPage() {
  const [items, setItems] = useState<Inspecteur[]>([]);
  const [iefs, setIefs] = useState<IefOption[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const load = (isFirstLoad = false) => {
    if (isFirstLoad) { setDataLoading(true); setDataError(null); }
    Promise.all([
      inspecteursApi.list({ archives: showArchived, limit: 1000 }),
      inspecteursApi.iefs(),
    ])
      .then(([rItems, rIefs]) => {
        setItems(rItems.data.items ?? []);
        setIefs(Array.isArray(rIefs.data) ? rIefs.data : []);
        setDataError(null);
      })
      .catch(() => { setDataError("Impossible de charger les données."); })
      .finally(() => { if (isFirstLoad) setDataLoading(false); });
  };
  useEffect(() => { load(true); }, [showArchived]); // eslint-disable-line react-hooks/exhaustive-deps

  const arch = useArchive({
    archive: (id) => inspecteursApi.delete(id),
    restore: (id) => inspecteursApi.restore(id),
    reload:  () => load(false),
  });

  const save = async () => {
    setLoading(true);
    setFormError(null);
    const enEdition = modal !== "create";
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      // En modification, une valeur vidée est envoyée vide : le serveur l'efface.
      email: form.email.trim() || (enEdition ? "" : undefined),
      title: form.title.trim() || (enEdition ? "" : undefined),
      ief: form.ief,
    };
    try {
      if (modal === "create") {
        await inspecteursApi.create(payload); // mot de passe temporaire = DEFAULT_USER_PASSWORD du serveur, changement forcé
      } else if (modal && typeof modal === "object" && modal.kind === "edit") {
        await inspecteursApi.update(modal.insp.id, payload);
      }
      load(false); setModal(null);
    } catch (e) {
      setFormError(messageErreur(e, "Impossible d'enregistrer l'inspecteur."));
    } finally { setLoading(false); }
  };

  const doDelete = async (insp: Inspecteur) => {
    setLoading(true);
    try { if (await arch.archive(insp.id)) setModal(null); }
    finally { setLoading(false); }
  };

  const doToggle = async (insp: Inspecteur) => {
    setLoading(true);
    try { await inspecteursApi.toggleStatus(insp.id); load(false); setModal(null); }
    finally { setLoading(false); }
  };

  const initials = (n: string) => n.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

  /* Réinitialiser la page quand la recherche change */
  useEffect(() => { setPage(1); }, [search]);

  const q = search.trim().toLowerCase();
  const filtered = items.filter(i =>
    !q || i.name.toLowerCase().includes(q) ||
    (i.ief ?? "").toLowerCase().includes(q) ||
    (i.phone ?? "").toLowerCase().includes(q)
  );
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => { setForm(EMPTY); setFormError(null); setModal("create"); };
  const openEdit = (insp: Inspecteur) => {
    setForm({ name: insp.name, phone: insp.phone ?? "", email: insp.email ?? "", title: insp.title ?? "", ief: insp.ief ?? "" });
    setFormError(null);
    setModal({ kind: "edit", insp });
  };

  // IEF actuelle absente de la liste (ex. plus aucune école) : on la garde sélectionnable.
  const iefOptions: IefOption[] = form.ief && !iefs.some(o => o.ief === form.ief)
    ? [{ ief: form.ief, nb_ecoles: 0 }, ...iefs]
    : iefs;
  const canSave = !!form.name.trim() && !!form.phone.trim() && !!form.ief;

  const inputCls = "w-full border border-border rounded-xl px-3.5 py-2.5 text-sm bg-bg text-tx outline-none focus:border-brand transition-colors";

  // Rendu par fonction (et non composant imbriqué) pour ne pas perdre le focus à chaque frappe.
  const renderFormModal = (title: string) => (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-surface">
          <h2 className="text-base font-bold text-tx">{title}</h2>
          <button onClick={() => setModal(null)} className="text-tx-muted hover:text-tx transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="text-xs text-tx-muted bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 leading-relaxed">
            L&apos;inspecteur se connecte à l&apos;application mobile avec ce numéro ; il voit en lecture seule les écoles de cette IEF et les rapports de leurs tuteurs et superviseurs.
          </div>
          <div>
            <label className="text-xs font-semibold text-tx-muted mb-1.5 block">Nom complet *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex : M. Abdoulaye Diop" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-tx-muted mb-1.5 block">Téléphone * <span className="font-normal">(connexion mobile)</span></label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="77 XXX XX XX" type="tel" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-tx-muted mb-1.5 block">Email</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="inspecteur@email.com" type="email" className={inputCls} />
            {modal !== "create" && <p className="text-[11px] text-tx-muted mt-1">Laisser vide pour retirer l&apos;email.</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-tx-muted mb-1.5 block">Fonction</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex : Inspecteur de l'enseignement élémentaire" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-tx-muted mb-1.5 block">IEF *</label>
            <select value={form.ief} onChange={e => setForm(f => ({ ...f, ief: e.target.value }))} className={inputCls}>
              <option value="">-- Sélectionner une IEF --</option>
              {iefOptions.map(o => (
                <option key={o.ief} value={o.ief}>{o.ief} ({o.nb_ecoles} école{o.nb_ecoles !== 1 ? "s" : ""})</option>
              ))}
            </select>
            {iefs.length === 0 && (
              <p className="text-xs text-warn mt-1.5">Aucune IEF disponible : renseignez d&apos;abord l&apos;IEF des écoles.</p>
            )}
          </div>
          {formError && (
            <div className="text-sm text-danger bg-danger-soft rounded-xl px-3.5 py-2.5">{formError}</div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors">Annuler</button>
            <button onClick={save} disabled={loading || !canSave}
              className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
              {loading ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-full flex-shrink-0 px-7 pb-7">
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Gestion Inspecteurs</h1>
          <p className="text-tx-muted text-sm mt-0.5">{items.length} inspecteur{items.length !== 1 ? "s" : ""} au total · consultation en lecture seule des écoles de leur IEF</p>
        </div>
        <div className="flex items-center gap-2">
        <button onClick={() => setShowImport(true)}
          className="flex items-center gap-2 bg-surface border border-border hover:bg-surface-alt text-tx px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          Importer
        </button>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Ajouter
        </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-5">
      <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-4 py-2.5 w-full max-w-sm">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-tx-muted flex-shrink-0"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un inspecteur ou une IEF…"
          className="flex-1 bg-transparent text-sm text-tx outline-none placeholder:text-tx-muted" />
      </div>
      <ShowArchivedToggle checked={showArchived} onChange={v => { setShowArchived(v); setPage(1); }} />
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden flex-1">
        <table className="w-full text-sm table-fixed">
          <colgroup><col className="w-[28%]" /><col className="w-[22%]" /><col className="w-[22%]" /><col className="w-[14%]" /><col className="w-[14%]" /></colgroup>
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              {["Inspecteur", "Téléphone / Email", "IEF", "Statut", "Actions"].map(h => (
                <th key={h} className="px-5 py-3 text-center text-xs font-semibold text-tx-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataLoading && (
              <tr><td colSpan={5} className="px-5 py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity=".2" /><path d="M12 2a10 10 0 0110 10" />
                  </svg>
                  <span className="text-sm text-tx-muted">Chargement…</span>
                </div>
              </td></tr>
            )}
            {!dataLoading && dataError && (
              <tr><td colSpan={5} className="px-5 py-12 text-center">
                <p className="text-sm text-danger">{dataError}</p>
                <button onClick={() => load(true)} className="mt-2 text-xs text-brand underline">Réessayer</button>
              </td></tr>
            )}
            {!dataLoading && !dataError && paginated.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-tx-muted text-sm">Aucun inspecteur trouvé</td></tr>
            )}
            {!dataLoading && !dataError && paginated.map(insp => (
              <tr key={insp.id} className="border-t border-border hover:bg-surface-alt transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-purple-soft text-purple flex items-center justify-center text-xs font-bold flex-shrink-0">{initials(insp.name)}</div>
                    <div className="min-w-0">
                      <div className="font-medium text-tx truncate">{insp.name}</div>
                      {insp.title && <div className="text-xs text-tx-muted truncate">{insp.title}</div>}
                      {insp.must_change_password && !insp.archived_at && <div className="text-[11px] text-warn">Doit changer son mot de passe</div>}
                      {insp.archived_at && <div className="mt-1"><ArchivedBadge at={insp.archived_at} /></div>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-center text-xs">
                  <div className="text-tx">{insp.phone || "—"}</div>
                  {insp.email && <div className="text-tx-muted truncate">{insp.email}</div>}
                </td>
                <td className="px-5 py-3.5 text-center text-xs">
                  {insp.ief
                    ? <span className="inline-flex px-2.5 py-1 rounded-full bg-primary-soft text-primary font-semibold">{insp.ief}</span>
                    : <span className="text-tx-muted italic">—</span>}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${insp.status === "actif" ? "bg-success-soft text-success" : "bg-surface-alt text-tx-muted"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${insp.status === "actif" ? "bg-success" : "bg-tx-muted"}`} />
                    {insp.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-center">
                  {insp.archived_at ? <RestoreButton onClick={() => arch.restore(insp.id)} /> : (
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => openEdit(insp)} title="Modifier" className="p-1.5 rounded-lg hover:bg-primary-soft text-tx-muted hover:text-primary transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button onClick={() => doToggle(insp)} title={insp.status === "actif" ? "Désactiver" : "Activer"} className="p-1.5 rounded-lg hover:bg-warn-soft text-tx-muted hover:text-warn transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10" /></svg>
                    </button>
                    <button onClick={() => setModal({ kind: "delete", insp })} title="Archiver" className="p-1.5 rounded-lg hover:bg-danger-soft text-tx-muted hover:text-danger transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                    </button>
                  </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-border px-5">
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      <ArchiveNotice message={arch.notice} onClose={() => arch.setNotice("")} />

      {showImport && (
        <ImportPointsFocaux iefs={iefs} onClose={() => setShowImport(false)} onDone={() => load()} />
      )}
      {modal === "create" && renderFormModal("Nouvel inspecteur")}
      {modal && typeof modal === "object" && modal.kind === "edit" && renderFormModal("Modifier l'inspecteur")}
      {modal && typeof modal === "object" && modal.kind === "delete" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h2 className="text-base font-bold text-tx mb-2">Archiver l&apos;inspecteur</h2>
            <p className="text-sm text-tx-muted mb-3">Archiver <strong>{modal.insp.name}</strong> ?</p>
            <div className="mb-6"><ArchiveConsequences user /></div>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt">Annuler</button>
              <button onClick={() => doDelete(modal.insp)} disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-danger text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {loading ? "Archivage…" : "Archiver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
