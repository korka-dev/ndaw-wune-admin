"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { evaluationDocsApi } from "@/lib/api";

const LANGUES = ["Seereer", "Pulaar", "Wolof"] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface EvalDoc {
  id:         string;
  langue:     string;
  titre:      string;
  lettres:    string[];
  syllabes:   string[];
  mots:       string[];
  operations: string[];
  is_active:  boolean;
  created_at: string;
}

// ── Helper : édition d'une liste de tokens ─────────────────────────────────

function TokenListInput({
  label, hint, value, onChange,
}: {
  label: string; hint?: string; value: string[]; onChange: (v: string[]) => void;
}) {
  const raw = value.join(" ");
  return (
    <div>
      <label className="text-xs font-semibold text-tx-muted mb-1 block">{label}</label>
      {hint && <p className="text-[11px] text-tx-muted/70 mb-1">{hint}</p>}
      <input
        type="text"
        value={raw}
        onChange={e => onChange(e.target.value.split(/\s+/).filter(Boolean))}
        placeholder="séparés par des espaces"
        className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-xl text-tx placeholder:text-tx-muted focus:outline-none focus:border-brand/50 font-mono"
      />
      <div className="flex flex-wrap gap-1 mt-2">
        {value.map((t, i) => (
          <span key={i} className="px-2 py-0.5 bg-brand-soft text-brand text-xs rounded-md font-medium">{t}</span>
        ))}
      </div>
    </div>
  );
}

// ── Modal formulaire ──────────────────────────────────────────────────────────

function DocModal({
  editing,
  onSave,
  onClose,
}: {
  editing:  EvalDoc | null;
  onSave:   (d: Omit<EvalDoc, "id" | "created_at">) => Promise<void>;
  onClose:  () => void;
}) {
  const [langue,     setLangue]     = useState(editing?.langue     ?? "");
  const [titre,      setTitre]      = useState(editing?.titre      ?? "");
  const [lettres,    setLettres]    = useState<string[]>(editing?.lettres    ?? []);
  const [syllabes,   setSyllabes]   = useState<string[]>(editing?.syllabes   ?? []);
  const [mots,       setMots]       = useState<string[]>(editing?.mots       ?? []);
  const [operations, setOperations] = useState<string[]>(editing?.operations ?? []);
  const [isActive,   setIsActive]   = useState(editing?.is_active  ?? true);
  const [saving,     setSaving]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!langue.trim() || !titre.trim()) return;
    setSaving(true);
    try {
      await onSave({ langue: langue.trim(), titre: titre.trim(), lettres, syllabes, mots, operations, is_active: isActive });
      onClose();
    } catch {
      alert("Erreur lors de l'enregistrement.");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="text-base font-bold text-tx">
            {editing ? "Modifier le dossier" : "Nouveau dossier d'évaluation"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-alt text-tx-muted transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Langue + Titre */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-tx-muted mb-1 block">Langue *</label>
              <select
                value={langue}
                onChange={e => setLangue(e.target.value)}
                required autoFocus
                className="w-full px-3 py-2.5 text-sm bg-bg border border-border rounded-xl text-tx focus:outline-none focus:border-brand/50 appearance-none cursor-pointer"
              >
                <option value="" disabled>Choisir une langue…</option>
                {LANGUES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-tx-muted mb-1 block">Titre *</label>
              <input
                type="text"
                value={titre}
                onChange={e => setTitre(e.target.value)}
                placeholder="Ex : Test Élève en Seereer"
                required
                className="w-full px-3 py-2.5 text-sm bg-bg border border-border rounded-xl text-tx placeholder:text-tx-muted focus:outline-none focus:border-brand/50"
              />
            </div>
          </div>

          {/* Section Lecture */}
          <div className="border border-border rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
              </svg>
              <span className="text-sm font-bold text-tx">Lecture</span>
            </div>
            <TokenListInput
              label="Lettres (/10)"
              hint="10 lettres à reconnaître, séparées par des espaces"
              value={lettres}
              onChange={setLettres}
            />
            <TokenListInput
              label="Syllabes (/10)"
              hint="10 syllabes à lire, séparées par des espaces"
              value={syllabes}
              onChange={setSyllabes}
            />
            <TokenListInput
              label="Mots (/10)"
              hint="10 mots à lire, séparés par des espaces"
              value={mots}
              onChange={setMots}
            />
          </div>

          {/* Section Maths */}
          <div className="border border-border rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
                <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
              </svg>
              <span className="text-sm font-bold text-tx">Mathématiques</span>
            </div>
            <div>
              <label className="text-xs font-semibold text-tx-muted mb-1 block">Opérations (/4)</label>
              <p className="text-[11px] text-tx-muted/70 mb-1">4 opérations — utilisez un espace pour séparer chaque opération (ex : <code className="bg-surface-alt px-1 rounded">22+35= 34+12= 19-7= 45-33=</code>)</p>
              <input
                type="text"
                value={operations.join(" ")}
                onChange={e => setOperations(e.target.value.split(/\s+/).filter(Boolean))}
                placeholder="22+35= 34+12= 19-7= 45-33="
                className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-xl text-tx placeholder:text-tx-muted focus:outline-none focus:border-brand/50 font-mono"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {operations.map((op, i) => (
                  <span key={i} className="px-2 py-0.5 bg-brand-soft text-brand text-xs rounded-md font-mono font-medium">{op}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Actif */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setIsActive(v => !v)}
              className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${isActive ? "bg-brand" : "bg-surface-alt border border-border"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-4" : "translate-x-0"}`} />
            </div>
            <span className="text-sm text-tx">Actif <span className="text-tx-muted">(visible dans l'app mobile)</span></span>
          </label>

          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-tx-muted border border-border rounded-xl hover:bg-surface-alt transition-colors">
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !langue.trim() || !titre.trim()}
              className="px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? "Enregistrement…" : editing ? "Mettre à jour" : "Créer le dossier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function EvaluationDocsPage() {
  const [docs,        setDocs]        = useState<EvalDoc[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [editing,     setEditing]     = useState<EvalDoc | null>(null);
  const [deleteId,    setDeleteId]    = useState<string | null>(null);
  const [deleting,    setDeleting]    = useState(false);
  const [toggling,    setToggling]    = useState<string | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const { data } = await evaluationDocsApi.list();
      setDocs(data);
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleSave = async (d: Omit<EvalDoc, "id" | "created_at">) => {
    if (editing) {
      await evaluationDocsApi.update(editing.id, d);
    } else {
      await evaluationDocsApi.create(d);
    }
    setEditing(null);
    await fetchDocs();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await evaluationDocsApi.delete(deleteId);
      setDocs(prev => prev.filter(d => d.id !== deleteId));
      setDeleteId(null);
    } catch { alert("Erreur lors de la suppression."); }
    finally { setDeleting(false); }
  };

  const toggleActive = async (doc: EvalDoc) => {
    setToggling(doc.id);
    try {
      await evaluationDocsApi.update(doc.id, { is_active: !doc.is_active });
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, is_active: !d.is_active } : d));
    } catch { alert("Erreur."); }
    finally { setToggling(null); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setUploadError(null);
    try {
      const { data } = await evaluationDocsApi.upload(file);
      setDocs(prev => [...prev, data]);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? "Erreur lors de l'import du document.";
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  const openEdit = (doc: EvalDoc) => { setEditing(doc); setShowForm(true); };
  const openNew  = () => { setEditing(null); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  return (
    <div className="p-7">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-tx mb-0.5">Dossiers d'évaluation</h1>
          <p className="text-tx-muted text-sm">
            Gérez les évaluations EGRA par langue affichées aux superviseurs dans l'application mobile.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Import .docx */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => { setUploadError(null); fileInputRef.current?.click(); }}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-border text-tx rounded-xl text-sm font-semibold hover:bg-surface-alt disabled:opacity-50 transition-colors"
          >
            {uploading ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Import en cours…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Importer un document
              </>
            )}
          </button>

          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nouveau dossier
          </button>
        </div>
      </div>

      {/* Erreur import */}
      {uploadError && (
        <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-danger">
          <svg width="16" height="16" className="flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="ml-auto text-danger/60 hover:text-danger">✕</button>
        </div>
      )}

      {/* Contenu */}
      {loading ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <p className="text-tx-muted text-sm">Chargement…</p>
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <svg className="mx-auto mb-3 text-tx-muted/40" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z"/>
            <path d="M14 3v6h6M8 13h8M8 17h5"/>
          </svg>
          <p className="text-tx-muted text-sm font-medium">Aucun dossier d'évaluation</p>
          <p className="text-tx-muted/60 text-xs mt-1">Créez un dossier pour chaque langue utilisée dans le programme.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map(doc => (
            <div
              key={doc.id}
              className={`bg-surface border rounded-2xl p-5 transition-colors group ${doc.is_active ? "border-border hover:border-brand/30" : "border-border/50 opacity-60"}`}
            >
              <div className="flex items-start gap-4">
                {/* Badge langue */}
                <div className="w-12 h-12 rounded-xl bg-brand-soft flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-black text-brand">{doc.langue.slice(0, 2).toUpperCase()}</span>
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h3 className="text-sm font-bold text-tx">{doc.titre}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      doc.is_active
                        ? "bg-success-soft text-success border-success/20"
                        : "bg-surface-alt text-tx-muted border-border"
                    }`}>
                      {doc.is_active ? "Actif" : "Inactif"}
                    </span>
                  </div>

                  {/* Prévisualisation du contenu */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-tx-muted">
                    <div>
                      <span className="font-semibold text-tx-muted/80">Lettres :</span>{" "}
                      <span className="font-mono">{doc.lettres.slice(0, 5).join(" ")}…</span>
                      <span className="ml-1 text-tx-muted/60">({doc.lettres.length}/10)</span>
                    </div>
                    <div>
                      <span className="font-semibold text-tx-muted/80">Syllabes :</span>{" "}
                      <span className="font-mono">{doc.syllabes.slice(0, 4).join(" ")}…</span>
                      <span className="ml-1 text-tx-muted/60">({doc.syllabes.length}/10)</span>
                    </div>
                    <div>
                      <span className="font-semibold text-tx-muted/80">Mots :</span>{" "}
                      <span className="font-mono">{doc.mots.slice(0, 4).join(" ")}…</span>
                      <span className="ml-1 text-tx-muted/60">({doc.mots.length}/10)</span>
                    </div>
                    <div>
                      <span className="font-semibold text-tx-muted/80">Opérations :</span>{" "}
                      <span className="font-mono">{doc.operations.slice(0, 2).join("  ")}…</span>
                      <span className="ml-1 text-tx-muted/60">({doc.operations.length}/4)</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Toggle actif */}
                  <button
                    onClick={() => toggleActive(doc)}
                    disabled={toggling === doc.id}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border text-tx-muted hover:bg-surface-alt transition-colors disabled:opacity-50"
                    title={doc.is_active ? "Désactiver" : "Activer"}
                  >
                    {toggling === doc.id ? "…" : doc.is_active ? "Désactiver" : "Activer"}
                  </button>

                  {/* Modifier */}
                  <button
                    onClick={() => openEdit(doc)}
                    className="px-3 py-1.5 text-xs font-semibold text-brand bg-brand-soft rounded-lg hover:opacity-80 transition-opacity"
                  >
                    Modifier
                  </button>

                  {/* Supprimer */}
                  <button
                    onClick={() => setDeleteId(doc.id)}
                    className="p-2 rounded-lg text-tx-muted hover:text-danger hover:bg-red-50 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                      <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal formulaire */}
      {showForm && (
        <DocModal editing={editing} onSave={handleSave} onClose={closeForm} />
      )}

      {/* Modal suppression */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <p className="text-sm font-semibold text-tx mb-1">Supprimer ce dossier ?</p>
            <p className="text-xs text-tx-muted mb-5">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-danger text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity">
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
