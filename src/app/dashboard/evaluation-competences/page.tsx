"use client";

import { useEffect, useState, useCallback } from "react";
import { evaluationCompetencesApi } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type Competence = {
  id: string;
  label: string;
  code: string;
  active: boolean;
  ordre: number;
};

// ── Composant principal ────────────────────────────────────────────────────────

export default function EvaluationCompetencesPage() {
  const [competences, setCompetences] = useState<Competence[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Competence | null>(null);
  const [saving, setSaving]     = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Formulaire
  const [label, setLabel]   = useState("");
  const [code, setCode]     = useState("");
  const [active, setActive] = useState(true);

  const fetchCompetences = useCallback(async () => {
    try {
      const { data } = await evaluationCompetencesApi.list();
      setCompetences(data);
    } catch {
      /* silencieux */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompetences(); }, [fetchCompetences]);

  // ── Formulaire : ouverture / réinitialisation ─────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setLabel(""); setCode(""); setActive(true);
    setShowForm(true);
  };

  const openEdit = (c: Competence) => {
    setEditing(c);
    setLabel(c.label); setCode(c.code); setActive(c.active);
    setShowForm(true);
  };

  const closeForm = () => setShowForm(false);

  // ── Sauvegarde ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!label.trim()) { alert("La compétence ne peut pas être vide."); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        label: label.trim(),
        active,
        ordre: editing?.ordre ?? competences.length,
      };
      if (code.trim()) payload.code = code.trim();

      if (editing) {
        await evaluationCompetencesApi.update(editing.id, payload);
      } else {
        await evaluationCompetencesApi.create(payload);
      }
      setShowForm(false);
      await fetchCompetences();
    } catch {
      alert("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  // ── Suppression ─────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await evaluationCompetencesApi.delete(deleteId);
      setCompetences(prev => prev.filter(c => c.id !== deleteId));
    } catch {
      alert("Erreur lors de la suppression.");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  // ── Activation / désactivation rapide ─────────────────────────────────────
  const toggleActive = async (c: Competence) => {
    try {
      await evaluationCompetencesApi.update(c.id, { active: !c.active });
      setCompetences(prev => prev.map(x => x.id === c.id ? { ...x, active: !x.active } : x));
    } catch {
      alert("Erreur lors de la mise à jour.");
    }
  };

  // ── Réordonnancement ────────────────────────────────────────────────────────
  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= competences.length) return;
    const a = competences[index];
    const b = competences[target];

    const reordered = [...competences];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setCompetences(reordered);

    try {
      await Promise.all([
        evaluationCompetencesApi.update(a.id, { ordre: b.ordre }),
        evaluationCompetencesApi.update(b.id, { ordre: a.ordre }),
      ]);
      await fetchCompetences();
    } catch {
      alert("Erreur lors du réordonnancement.");
      await fetchCompetences();
    }
  };

  const competenceToDelete = competences.find(c => c.id === deleteId);

  // ── Rendu ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-7">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-tx mb-0.5">Gestion Évaluations</h1>
          <p className="text-tx-muted text-sm">
            Compétences affichées dans l'écran d'évaluation des superviseurs (app mobile)
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Ajouter une compétence
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <p className="text-tx-muted text-sm">Chargement…</p>
        </div>
      ) : competences.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <p className="text-tx-muted text-sm font-medium">Aucune compétence pour l'instant</p>
          <p className="text-tx-muted/60 text-xs mt-1">Ajoutez des compétences pour qu'elles apparaissent dans l'écran d'évaluation des superviseurs.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-xs font-semibold text-tx-muted uppercase tracking-wide">
              {competences.length} compétence{competences.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="divide-y divide-border">
            {competences.map((c, index) => (
              <div key={c.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface-alt transition-colors group">
                {/* Réordonnancement */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="p-1 rounded text-tx-muted hover:text-brand disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Monter"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={index === competences.length - 1}
                    className="p-1 rounded text-tx-muted hover:text-brand disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Descendre"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-tx">{c.label}</span>
                    {!c.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-tx-muted font-medium">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-tx-muted font-mono">{c.code}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {/* Activer / désactiver */}
                  <button
                    onClick={() => toggleActive(c)}
                    title={c.active ? "Désactiver" : "Activer"}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${c.active ? "bg-brand" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${c.active ? "translate-x-4" : ""}`} />
                  </button>
                  {/* Modifier */}
                  <button
                    onClick={() => openEdit(c)}
                    title="Modifier"
                    className="p-2 rounded-lg text-tx-muted hover:text-brand hover:bg-brand-soft transition-colors"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  {/* Supprimer */}
                  <button
                    onClick={() => setDeleteId(c.id)}
                    title="Supprimer"
                    className="p-2 rounded-lg text-tx-muted hover:text-danger hover:bg-red-50 transition-colors"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-tx mb-4">
              {editing ? "Modifier la compétence" : "Nouvelle compétence"}
            </h2>

            <div className="space-y-4">
              {/* Label */}
              <div>
                <label className="block text-xs font-semibold text-tx-muted uppercase tracking-wide mb-1.5">
                  Intitulé de la compétence
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="Ex : Lecture · Sons des lettres"
                  className="w-full px-3 py-2.5 text-sm bg-bg border border-border rounded-xl text-tx placeholder:text-tx-muted focus:outline-none focus:border-brand/50 transition-colors"
                />
              </div>

              {/* Code (optionnel à la création) */}
              {editing && (
                <div>
                  <label className="block text-xs font-semibold text-tx-muted uppercase tracking-wide mb-1.5">
                    Code (identifiant technique)
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="ex_code_competence"
                    className="w-full px-3 py-2.5 text-sm bg-bg border border-border rounded-xl text-tx placeholder:text-tx-muted focus:outline-none focus:border-brand/50 transition-colors font-mono"
                  />
                  <p className="text-xs text-tx-muted/70 mt-1">
                    Attention : modifier le code dissociera les évaluations déjà enregistrées sous l'ancien code.
                  </p>
                </div>
              )}

              {/* Toggle actif */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-tx">Compétence active</span>
                <button
                  onClick={() => setActive(a => !a)}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${active ? "bg-brand" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${active ? "translate-x-4" : ""}`} />
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeForm}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-tx">Supprimer cette compétence ?</p>
                <p className="text-xs text-tx-muted mt-0.5 truncate max-w-[200px]">{competenceToDelete?.label}</p>
              </div>
            </div>
            <p className="text-sm text-tx-muted mb-5">
              La compétence sera définitivement supprimée et n'apparaîtra plus dans l'app mobile. Les évaluations déjà enregistrées sous ce code resteront en base.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-danger text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
