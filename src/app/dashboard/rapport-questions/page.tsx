"use client";

import { useEffect, useState, useCallback } from "react";
import { rapportQuestionsApi, rapportDifficultesApi, rapportLibellesApi } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type QuestionType = "texte_court" | "texte_long" | "nombre" | "oui_non" | "choix_unique" | "choix_multiple";
type QuestionCible = "tuteur" | "superviseur" | "tous";

type Question = {
  id: string;
  label: string;
  type: QuestionType;
  options: string[] | null;
  required: boolean;
  active: boolean;
  ordre: number;
  cible: QuestionCible;
};

const TYPE_LABELS: Record<QuestionType, string> = {
  texte_court:    "Texte court",
  texte_long:     "Texte long",
  nombre:         "Nombre",
  oui_non:        "Oui / Non",
  choix_unique:   "Choix unique",
  choix_multiple: "Choix multiple",
};

const CIBLE_LABELS: Record<QuestionCible, string> = {
  tuteur:      "Tuteur",
  superviseur: "Superviseur",
  tous:        "Tuteur + Superviseur",
};

const CIBLE_FILTERS: { value: QuestionCible | "toutes"; label: string }[] = [
  { value: "toutes",     label: "Toutes" },
  { value: "tuteur",      label: "Tuteur" },
  { value: "superviseur", label: "Superviseur" },
  { value: "tous",        label: "Tuteur + Superviseur" },
];

const NEEDS_OPTIONS: QuestionType[] = ["choix_unique", "choix_multiple"];

const VALID_TYPES: QuestionType[] = [
  "texte_court", "texte_long", "nombre", "oui_non", "choix_unique", "choix_multiple",
];
const VALID_CIBLES: QuestionCible[] = ["tuteur", "superviseur", "tous"];

type Difficulte = {
  id: string;
  label: string;
  active: boolean;
  ordre: number;
};

// ── Composant principal ────────────────────────────────────────────────────────

export default function RapportQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Question | null>(null);
  const [saving, setSaving]       = useState(false);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const [importing, setImporting] = useState(false);
  const [cibleFilter, setCibleFilter] = useState<QuestionCible | "toutes">("toutes");

  // Formulaire
  const [label, setLabel]       = useState("");
  const [type, setType]         = useState<QuestionType>("texte_court");
  const [options, setOptions]   = useState<string[]>([""]);
  const [required, setRequired] = useState(false);
  const [active, setActive]     = useState(true);
  const [cible, setCible]       = useState<QuestionCible>("tuteur");

  const fetchQuestions = useCallback(async () => {
    try {
      const { data } = await rapportQuestionsApi.list();
      setQuestions(data);
    } catch {
      /* silencieux */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  // ── Formulaire : ouverture / réinitialisation ─────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setLabel(""); setType("texte_court"); setOptions([""]);
    setRequired(false); setActive(true); setCible("tuteur");
    setShowForm(true);
  };

  const openEdit = (q: Question) => {
    setEditing(q);
    setLabel(q.label); setType(q.type);
    setOptions(q.options && q.options.length > 0 ? q.options : [""]);
    setRequired(q.required); setActive(q.active); setCible(q.cible ?? "tuteur");
    setShowForm(true);
  };

  const closeForm = () => setShowForm(false);

  // ── Import en masse (fichier JSON) ─────────────────────────────────────────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de réimporter le même fichier
    if (!file) return;

    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      alert("Fichier invalide : le JSON n'a pas pu être lu.");
      return;
    }

    const rawItems = Array.isArray(parsed) ? parsed : (parsed as any)?.questions;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      alert("Le fichier doit contenir un tableau de questions (ou un objet { questions: [...] }).");
      return;
    }

    // Validation et normalisation
    const toImport: { label: string; type: QuestionType; options: string[] | null; required: boolean; active: boolean; ordre: number; cible: QuestionCible }[] = [];
    for (const [i, raw] of rawItems.entries()) {
      const label = typeof raw?.label === "string" ? raw.label.trim() : "";
      const type  = VALID_TYPES.includes(raw?.type) ? raw.type as QuestionType : null;
      if (!label || !type) {
        alert(`Ligne ${i + 1} invalide : "label" et "type" sont obligatoires (type valide : ${VALID_TYPES.join(", ")}).`);
        return;
      }
      const options = Array.isArray(raw?.options) ? raw.options.map(String).map((o: string) => o.trim()).filter(Boolean) : null;
      if (NEEDS_OPTIONS.includes(type) && (!options || options.length === 0)) {
        alert(`Ligne ${i + 1} ("${label}") : les questions de type "${TYPE_LABELS[type]}" nécessitent au moins une option.`);
        return;
      }
      const cible = VALID_CIBLES.includes(raw?.cible) ? raw.cible as QuestionCible : "tuteur";
      toImport.push({
        label,
        type,
        options: NEEDS_OPTIONS.includes(type) ? options : null,
        required: Boolean(raw?.required),
        active: raw?.active === undefined ? true : Boolean(raw.active),
        ordre: typeof raw?.ordre === "number" ? raw.ordre : questions.length + i,
        cible,
      });
    }

    setImporting(true);
    try {
      for (const item of toImport) {
        await rapportQuestionsApi.create(item);
      }
      await fetchQuestions();
      alert(`${toImport.length} question${toImport.length > 1 ? "s" : ""} importée${toImport.length > 1 ? "s" : ""} avec succès.`);
    } catch {
      alert("Une erreur est survenue pendant l'import. Certaines questions ont peut-être déjà été importées.");
      await fetchQuestions();
    } finally {
      setImporting(false);
    }
  };

  // ── Sauvegarde ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!label.trim()) { alert("La question ne peut pas être vide."); return; }
    const cleanOptions = options.map(o => o.trim()).filter(Boolean);
    if (NEEDS_OPTIONS.includes(type) && cleanOptions.length === 0) {
      alert("Ajoutez au moins une option de réponse.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        label: label.trim(),
        type,
        options: NEEDS_OPTIONS.includes(type) ? cleanOptions : null,
        required,
        active,
        ordre: editing?.ordre ?? questions.length,
        cible,
      };
      if (editing) {
        await rapportQuestionsApi.update(editing.id, payload);
      } else {
        await rapportQuestionsApi.create(payload);
      }
      setShowForm(false);
      await fetchQuestions();
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
      await rapportQuestionsApi.delete(deleteId);
      setQuestions(prev => prev.filter(q => q.id !== deleteId));
    } catch {
      alert("Erreur lors de la suppression.");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  // ── Activation / désactivation rapide ─────────────────────────────────────
  const toggleActive = async (q: Question) => {
    try {
      await rapportQuestionsApi.update(q.id, { active: !q.active });
      setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, active: !x.active } : x));
    } catch {
      alert("Erreur lors de la mise à jour.");
    }
  };

  // ── Réordonnancement (au sein de la liste filtrée actuellement affichée) ────
  const move = async (list: Question[], index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const a = list[index];
    const b = list[target];

    try {
      await Promise.all([
        rapportQuestionsApi.update(a.id, { ordre: b.ordre }),
        rapportQuestionsApi.update(b.id, { ordre: a.ordre }),
      ]);
      await fetchQuestions();
    } catch {
      alert("Erreur lors du réordonnancement.");
      await fetchQuestions();
    }
  };

  const questionToDelete = questions.find(q => q.id === deleteId);
  const filteredQuestions = cibleFilter === "toutes"
    ? questions
    : questions.filter(q => q.cible === cibleFilter);

  // ── Rendu ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-7">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-tx mb-0.5">Questions de Rapport</h1>
          <p className="text-tx-muted text-sm">
            Questions complémentaires affichées dynamiquement dans les rapports du tuteur et/ou du superviseur sur l'app mobile
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className={`flex items-center gap-2 px-4 py-2.5 bg-surface border border-border text-tx rounded-xl text-sm font-semibold hover:bg-surface-alt transition-colors cursor-pointer ${importing ? "opacity-60 pointer-events-none" : ""}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {importing ? "Import en cours…" : "Importer"}
            <input type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile} disabled={importing} />
          </label>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Ajouter une question
          </button>
        </div>
      </div>

      {/* Filtre par destinataire */}
      <div className="flex items-center gap-1.5 mb-4">
        {CIBLE_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setCibleFilter(f.value)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              cibleFilter === f.value
                ? "bg-brand text-white"
                : "bg-surface border border-border text-tx-muted hover:bg-surface-alt"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <p className="text-tx-muted text-sm">Chargement…</p>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <p className="text-tx-muted text-sm font-medium">Aucune question complémentaire pour l'instant</p>
          <p className="text-tx-muted/60 text-xs mt-1">Ajoutez des questions pour qu'elles apparaissent dans le rapport journalier de l'app mobile.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-xs font-semibold text-tx-muted uppercase tracking-wide">
              {filteredQuestions.length} question{filteredQuestions.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="divide-y divide-border">
            {filteredQuestions.map((q, index) => (
              <div key={q.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface-alt transition-colors group">
                {/* Réordonnancement */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => move(filteredQuestions, index, -1)}
                    disabled={index === 0}
                    className="p-1 rounded text-tx-muted hover:text-brand disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Monter"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                  </button>
                  <button
                    onClick={() => move(filteredQuestions, index, 1)}
                    disabled={index === filteredQuestions.length - 1}
                    className="p-1 rounded text-tx-muted hover:text-brand disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Descendre"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-tx">{q.label}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand-soft text-brand font-medium">{CIBLE_LABELS[q.cible ?? "tuteur"]}</span>
                    {q.required && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-danger font-medium">Obligatoire</span>
                    )}
                    {!q.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-tx-muted font-medium">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-tx-muted">{TYPE_LABELS[q.type]}</span>
                    {q.options && q.options.length > 0 && (
                      <>
                        <span className="text-tx-muted/40 text-xs">·</span>
                        <span className="text-xs text-tx-muted truncate">{q.options.join(", ")}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {/* Activer / désactiver */}
                  <button
                    onClick={() => toggleActive(q)}
                    title={q.active ? "Désactiver" : "Activer"}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${q.active ? "bg-brand" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${q.active ? "translate-x-4" : ""}`} />
                  </button>
                  {/* Modifier */}
                  <button
                    onClick={() => openEdit(q)}
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
                    onClick={() => setDeleteId(q.id)}
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

      {/* Libellés des champs fixes des rapports */}
      <LibellesSection />

      {/* Difficultés du rapport */}
      <DifficultesSection />

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-tx mb-4">
              {editing ? "Modifier la question" : "Nouvelle question"}
            </h2>

            <div className="space-y-4">
              {/* Label */}
              <div>
                <label className="block text-xs font-semibold text-tx-muted uppercase tracking-wide mb-1.5">
                  Intitulé de la question
                </label>
                <textarea
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="Ex : Avez-vous reçu le matériel pédagogique ?"
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm bg-bg border border-border rounded-xl text-tx placeholder:text-tx-muted focus:outline-none focus:border-brand/50 transition-colors resize-none"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-semibold text-tx-muted uppercase tracking-wide mb-1.5">
                  Type de réponse
                </label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as QuestionType)}
                  className="w-full px-3 py-2.5 text-sm bg-bg border border-border rounded-xl text-tx focus:outline-none focus:border-brand/50 transition-colors"
                >
                  {Object.entries(TYPE_LABELS).map(([val, lab]) => (
                    <option key={val} value={val}>{lab}</option>
                  ))}
                </select>
              </div>

              {/* Destinataire */}
              <div>
                <label className="block text-xs font-semibold text-tx-muted uppercase tracking-wide mb-1.5">
                  Destiné à
                </label>
                <select
                  value={cible}
                  onChange={e => setCible(e.target.value as QuestionCible)}
                  className="w-full px-3 py-2.5 text-sm bg-bg border border-border rounded-xl text-tx focus:outline-none focus:border-brand/50 transition-colors"
                >
                  {Object.entries(CIBLE_LABELS).map(([val, lab]) => (
                    <option key={val} value={val}>{lab}</option>
                  ))}
                </select>
              </div>

              {/* Options (choix unique / multiple) */}
              {NEEDS_OPTIONS.includes(type) && (
                <div>
                  <label className="block text-xs font-semibold text-tx-muted uppercase tracking-wide mb-1.5">
                    Options de réponse
                  </label>
                  <div className="space-y-2">
                    {options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={opt}
                          onChange={e => setOptions(prev => prev.map((o, idx) => idx === i ? e.target.value : o))}
                          placeholder={`Option ${i + 1}`}
                          className="flex-1 px-3 py-2 text-sm bg-bg border border-border rounded-xl text-tx placeholder:text-tx-muted focus:outline-none focus:border-brand/50 transition-colors"
                        />
                        <button
                          onClick={() => setOptions(prev => prev.filter((_, idx) => idx !== i))}
                          disabled={options.length === 1}
                          className="p-2 rounded-lg text-tx-muted hover:text-danger hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setOptions(prev => [...prev, ""])}
                    className="mt-2 text-xs font-semibold text-brand hover:opacity-80 transition-opacity"
                  >
                    + Ajouter une option
                  </button>
                </div>
              )}

              {/* Toggles */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-tx">Réponse obligatoire</span>
                <button
                  onClick={() => setRequired(r => !r)}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${required ? "bg-brand" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${required ? "translate-x-4" : ""}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-tx">Question active</span>
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
                <p className="text-sm font-semibold text-tx">Supprimer cette question ?</p>
                <p className="text-xs text-tx-muted mt-0.5 truncate max-w-[200px]">{questionToDelete?.label}</p>
              </div>
            </div>
            <p className="text-sm text-tx-muted mb-5">
              La question sera définitivement supprimée et n'apparaîtra plus dans l'app mobile. Cette action est irréversible.
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

// ── Section : Libellés des champs fixes des rapports ───────────────────────────
// Contrairement aux questions complémentaires, l'ensemble des clés est fixe
// (une par champ structurel du formulaire tuteur/superviseur) : on ne peut
// qu'éditer le texte affiché, pas ajouter/supprimer une clé.

type Libelle = { id: string; cle: string; cible: "tuteur" | "superviseur"; texte: string };

function LibellesSection() {
  const [items, setItems]     = useState<Libelle[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<"tuteur" | "superviseur">("tuteur");
  const [editingCle, setEditingCle] = useState<string | null>(null);
  const [draftTexte, setDraftTexte] = useState("");
  const [saving, setSaving]   = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const { data } = await rapportLibellesApi.list();
      setItems(data);
    } catch {
      /* silencieux */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openEdit = (l: Libelle) => { setEditingCle(l.cle); setDraftTexte(l.texte); };
  const cancelEdit = () => { setEditingCle(null); setDraftTexte(""); };

  const handleSave = async (cle: string) => {
    if (!draftTexte.trim()) { alert("Le libellé ne peut pas être vide."); return; }
    setSaving(true);
    try {
      await rapportLibellesApi.update(cle, { texte: draftTexte.trim() });
      setItems(prev => prev.map(x => x.cle === cle ? { ...x, texte: draftTexte.trim() } : x));
      cancelEdit();
    } catch {
      alert("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = items.filter(l => l.cible === tab);

  return (
    <div className="mt-8">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-tx mb-0.5">Libellés des rapports</h2>
        <p className="text-tx-muted text-sm">
          Texte des questions fixes affichées dans les formulaires de rapport du tuteur et du superviseur sur l'app mobile
        </p>
      </div>

      <div className="flex items-center gap-1.5 mb-4">
        {(["tuteur", "superviseur"] as const).map(v => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              tab === v ? "bg-brand text-white" : "bg-surface border border-border text-tx-muted hover:bg-surface-alt"
            }`}
          >
            {v === "tuteur" ? "Tuteur" : "Superviseur"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <p className="text-tx-muted text-sm">Chargement…</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map(l => (
              <div key={l.cle} className="flex items-center gap-4 px-4 py-3.5">
                {editingCle === l.cle ? (
                  <>
                    <textarea
                      value={draftTexte}
                      onChange={e => setDraftTexte(e.target.value)}
                      rows={2}
                      autoFocus
                      className="flex-1 px-3 py-2 text-sm bg-bg border border-border rounded-xl text-tx focus:outline-none focus:border-brand/50 transition-colors resize-none"
                    />
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="px-3 py-2 rounded-lg text-xs font-semibold text-tx-muted hover:bg-surface-alt transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => handleSave(l.cle)}
                        disabled={saving}
                        className="px-3 py-2 rounded-lg text-xs font-semibold bg-brand text-white hover:opacity-90 transition-opacity disabled:opacity-60"
                      >
                        {saving ? "…" : "Enregistrer"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-tx">{l.texte}</span>
                    <button
                      onClick={() => openEdit(l)}
                      title="Modifier"
                      className="p-2 rounded-lg text-tx-muted hover:text-brand hover:bg-brand-soft transition-colors flex-shrink-0"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section : Difficultés du rapport ───────────────────────────────────────────
// Liste des options affichées dans l'étape "Difficultés rencontrées" du rapport
// journalier de l'app mobile (autrefois codée en dur, désormais configurable ici).

function DifficultesSection() {
  const [items, setItems]         = useState<Difficulte[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Difficulte | null>(null);
  const [label, setLabel]         = useState("");
  const [saving, setSaving]       = useState(false);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const { data } = await rapportDifficultesApi.list();
      setItems(data);
    } catch {
      /* silencieux */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openCreate = () => { setEditing(null); setLabel(""); setShowForm(true); };
  const openEdit = (d: Difficulte) => { setEditing(d); setLabel(d.label); setShowForm(true); };
  const closeForm = () => setShowForm(false);

  const handleSave = async () => {
    if (!label.trim()) { alert("La difficulté ne peut pas être vide."); return; }
    setSaving(true);
    try {
      if (editing) {
        await rapportDifficultesApi.update(editing.id, { label: label.trim() });
      } else {
        await rapportDifficultesApi.create({ label: label.trim(), ordre: items.length });
      }
      setShowForm(false);
      await fetchItems();
    } catch {
      alert("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await rapportDifficultesApi.delete(deleteId);
      setItems(prev => prev.filter(d => d.id !== deleteId));
    } catch {
      alert("Erreur lors de la suppression.");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const toggleActive = async (d: Difficulte) => {
    try {
      await rapportDifficultesApi.update(d.id, { active: !d.active });
      setItems(prev => prev.map(x => x.id === d.id ? { ...x, active: !x.active } : x));
    } catch {
      alert("Erreur lors de la mise à jour.");
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];

    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setItems(reordered);

    try {
      await Promise.all([
        rapportDifficultesApi.update(a.id, { ordre: b.ordre }),
        rapportDifficultesApi.update(b.id, { ordre: a.ordre }),
      ]);
      await fetchItems();
    } catch {
      alert("Erreur lors du réordonnancement.");
      await fetchItems();
    }
  };

  const itemToDelete = items.find(d => d.id === deleteId);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-tx mb-0.5">Difficultés du rapport</h2>
          <p className="text-tx-muted text-sm">
            Options proposées dans l'étape « Difficultés rencontrées » du rapport journalier de l'app mobile
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Ajouter une difficulté
        </button>
      </div>

      {loading ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <p className="text-tx-muted text-sm">Chargement…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <p className="text-tx-muted text-sm font-medium">Aucune difficulté pour l'instant</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-xs font-semibold text-tx-muted uppercase tracking-wide">
              {items.length} difficulté{items.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="divide-y divide-border">
            {items.map((d, index) => (
              <div key={d.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface-alt transition-colors group">
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
                    disabled={index === items.length - 1}
                    className="p-1 rounded text-tx-muted hover:text-brand disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Descendre"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-tx">{d.label}</span>
                    {!d.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-tx-muted font-medium">Inactive</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleActive(d)}
                    title={d.active ? "Désactiver" : "Activer"}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${d.active ? "bg-brand" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${d.active ? "translate-x-4" : ""}`} />
                  </button>
                  <button
                    onClick={() => openEdit(d)}
                    title="Modifier"
                    className="p-2 rounded-lg text-tx-muted hover:text-brand hover:bg-brand-soft transition-colors"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteId(d.id)}
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
              {editing ? "Modifier la difficulté" : "Nouvelle difficulté"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-tx-muted uppercase tracking-wide mb-1.5">
                  Intitulé
                </label>
                <textarea
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="Ex : Gestion des groupes"
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm bg-bg border border-border rounded-xl text-tx placeholder:text-tx-muted focus:outline-none focus:border-brand/50 transition-colors resize-none"
                />
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
                <p className="text-sm font-semibold text-tx">Supprimer cette difficulté ?</p>
                <p className="text-xs text-tx-muted mt-0.5 truncate max-w-[200px]">{itemToDelete?.label}</p>
              </div>
            </div>
            <p className="text-sm text-tx-muted mb-5">
              Elle sera définitivement supprimée et n'apparaîtra plus dans l'app mobile. Cette action est irréversible.
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
