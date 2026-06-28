"use client";
import { useEffect, useState, useCallback } from "react";
import { evaluationSujetsApi } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SujetOut {
  id: string;
  titre: string;
  description: string | null;
  nb_eleves_par_classe: number;
  session_id: string | null;
  nb_tirages: number;
  nb_evalues: number;
  created_at: string;
}

interface TirageOut {
  id: string;
  eleve_id: string;
  eleve_nom: string;
  eleve_prenom: string | null;
  eleve_classe: string | null;
  eleve_school: string | null;
  superviseur_id: string | null;
  superviseur_nom: string | null;
  resultat: string | null;
  commentaire: string | null;
  date_eval: string | null;
  audio_filename: string | null;
  created_at: string;
}

interface SujetDetail extends SujetOut {
  tirages: TirageOut[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

const RESULTAT_CFG: Record<string, { label: string; cls: string }> = {
  acquis:  { label: "Acquis",  cls: "bg-success-soft text-success border-success/20" },
  a_aider: { label: "À aider", cls: "bg-warn-soft text-warn border-warn/20" },
};

// ── Modal détail sujet ─────────────────────────────────────────────────────────

function SujetDetailModal({
  sujet,
  onClose,
}: {
  sujet: SujetDetail;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filterResultat, setFilterResultat] = useState<"all" | "acquis" | "a_aider" | "pending">("all");

  const filtered = sujet.tirages.filter(t => {
    if (filterResultat === "pending" && t.resultat !== null) return false;
    if (filterResultat === "acquis" && t.resultat !== "acquis") return false;
    if (filterResultat === "a_aider" && t.resultat !== "a_aider") return false;
    if (search) {
      const q = search.toLowerCase();
      const nom = `${t.eleve_prenom ?? ""} ${t.eleve_nom}`.toLowerCase();
      if (!nom.includes(q) && !(t.eleve_classe ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const pct = sujet.nb_tirages > 0
    ? Math.round((sujet.nb_evalues / sujet.nb_tirages) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-3xl my-8">
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-tx">{sujet.titre}</h2>
            {sujet.description && (
              <p className="text-sm text-tx-muted mt-0.5">{sujet.description}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-alt text-tx-muted transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Stats */}
        <div className="px-6 py-4 border-b border-border flex items-center gap-6">
          <div>
            <p className="text-xs text-tx-muted">Tirés</p>
            <p className="text-2xl font-bold text-tx">{sujet.nb_tirages}</p>
          </div>
          <div>
            <p className="text-xs text-tx-muted">Évalués</p>
            <p className="text-2xl font-bold text-success">{sujet.nb_evalues}</p>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-tx-muted">Progression</span>
              <span className="text-xs font-bold text-tx">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-surface-alt overflow-hidden">
              <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="px-6 py-3 border-b border-border flex items-center gap-3 flex-wrap">
          <div className="flex gap-1">
            {(["all", "pending", "acquis", "a_aider"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterResultat(f)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  filterResultat === f ? "bg-brand text-white border-brand" : "border-border text-tx-muted hover:bg-surface-alt"
                }`}
              >
                {f === "all" ? "Tous" : f === "pending" ? "En attente" : f === "acquis" ? "Acquis" : "À aider"}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Chercher un élève…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[160px] px-3 py-1.5 text-xs bg-surface-alt border border-border rounded-lg text-tx placeholder:text-tx-muted focus:outline-none focus:border-brand/50"
          />
        </div>

        {/* Liste tirages */}
        <div className="max-h-[50vh] overflow-y-auto divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-tx-muted">Aucun résultat.</div>
          ) : filtered.map(t => {
            const res = t.resultat ? RESULTAT_CFG[t.resultat] : null;
            return (
              <div key={t.id} className="flex items-center gap-3 px-6 py-3 hover:bg-surface-alt/40">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-surface-alt flex items-center justify-center text-xs font-bold text-tx-muted flex-shrink-0">
                  {t.eleve_nom.charAt(0)}{(t.eleve_prenom ?? "").charAt(0)}
                </div>
                {/* Info élève */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-tx truncate">
                    {t.eleve_prenom ? `${t.eleve_prenom} ` : ""}{t.eleve_nom}
                  </p>
                  <p className="text-xs text-tx-muted">
                    {t.eleve_classe ?? "—"}
                    {t.eleve_school ? ` · ${t.eleve_school}` : ""}
                  </p>
                </div>
                {/* Superviseur */}
                {t.superviseur_nom && (
                  <p className="text-xs text-tx-muted flex-shrink-0 max-w-[120px] truncate">{t.superviseur_nom}</p>
                )}
                {/* Résultat */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  {res ? (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${res.cls}`}>
                      {res.label}
                    </span>
                  ) : (
                    <span className="text-xs text-tx-muted italic">En attente</span>
                  )}
                  {/* Audio */}
                  {t.audio_filename && (
                    <a
                      href={evaluationSujetsApi.audioUrl(t.audio_filename)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg hover:bg-brand-soft text-brand transition-colors"
                      title="Écouter l'enregistrement"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07"/>
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function EvaluationSujetsPage() {
  const [sujets, setSujets]         = useState<SujetOut[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [creating, setCreating]     = useState(false);
  const [titre, setTitre]           = useState("");
  const [description, setDescription] = useState("");
  const [nbEleves, setNbEleves]     = useState(5);
  const [detailId, setDetailId]     = useState<string | null>(null);
  const [detail, setDetail]         = useState<SujetDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [deleting, setDeleting]     = useState(false);

  const fetchSujets = useCallback(async () => {
    try {
      const { data } = await evaluationSujetsApi.list();
      setSujets(data);
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSujets(); }, [fetchSujets]);

  const openDetail = async (id: string) => {
    setDetailId(id);
    setLoadingDetail(true);
    try {
      const { data } = await evaluationSujetsApi.get(id);
      setDetail(data);
    } catch { setDetail(null); }
    finally { setLoadingDetail(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre.trim()) return;
    setCreating(true);
    try {
      await evaluationSujetsApi.create({
        titre: titre.trim(),
        description: description.trim() || undefined,
        nb_eleves_par_classe: nbEleves,
      });
      setTitre(""); setDescription(""); setNbEleves(5); setShowForm(false);
      await fetchSujets();
    } catch {
      alert("Erreur lors de la création du sujet.");
    } finally { setCreating(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await evaluationSujetsApi.delete(deleteId);
      setSujets(prev => prev.filter(s => s.id !== deleteId));
      setDeleteId(null);
    } catch {
      alert("Erreur lors de la suppression.");
    } finally { setDeleting(false); }
  };

  return (
    <div className="p-7">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-tx mb-0.5">Sujets d'évaluation</h1>
          <p className="text-tx-muted text-sm">
            Créez un sujet — le système tire aléatoirement des élèves par classe
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nouveau sujet
        </button>
      </div>

      {/* Modal de création */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="text-base font-bold text-tx">Nouveau sujet d'évaluation</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-surface-alt text-tx-muted transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-tx-muted mb-1 block">Titre *</label>
                <input
                  type="text"
                  value={titre}
                  onChange={e => setTitre(e.target.value)}
                  placeholder="Ex. Évaluation lecture Semaine 3"
                  required
                  autoFocus
                  className="w-full px-3 py-2.5 text-sm bg-bg border border-border rounded-xl text-tx placeholder:text-tx-muted focus:outline-none focus:border-brand/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-tx-muted mb-1 block">
                  Élèves par classe à tirer <span className="text-tx-muted/60">(0 = tous)</span>
                </label>
                <input
                  type="number"
                  value={nbEleves}
                  onChange={e => setNbEleves(Math.max(0, parseInt(e.target.value) || 0))}
                  min={0}
                  className="w-full px-3 py-2.5 text-sm bg-bg border border-border rounded-xl text-tx focus:outline-none focus:border-brand/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-tx-muted mb-1 block">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Instructions pour le superviseur…"
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm bg-bg border border-border rounded-xl text-tx placeholder:text-tx-muted focus:outline-none focus:border-brand/50 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 text-sm text-tx-muted border border-border rounded-xl hover:bg-surface-alt transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating || !titre.trim()}
                  className="px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {creating ? "Création…" : "Créer et tirer au sort"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Liste des sujets */}
      {loading ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <p className="text-tx-muted text-sm">Chargement…</p>
        </div>
      ) : sujets.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <svg className="mx-auto mb-3 text-tx-muted/40" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/>
          </svg>
          <p className="text-tx-muted text-sm font-medium">Aucun sujet d'évaluation</p>
          <p className="text-tx-muted/60 text-xs mt-1">Créez un sujet pour démarrer un tirage aléatoire d'élèves.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sujets.map(s => {
            const pct = s.nb_tirages > 0 ? Math.round((s.nb_evalues / s.nb_tirages) * 100) : 0;
            return (
              <div
                key={s.id}
                className="bg-surface border border-border rounded-2xl p-5 hover:border-brand/30 transition-colors group"
              >
                <div className="flex items-start gap-4">
                  {/* Icône */}
                  <div className="w-10 h-10 rounded-xl bg-brand-soft flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                      <rect x="9" y="3" width="6" height="4" rx="1"/>
                      <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/>
                    </svg>
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-tx">{s.titre}</h3>
                      <span className="text-xs text-tx-muted">{fmtDate(s.created_at)}</span>
                    </div>
                    {s.description && (
                      <p className="text-xs text-tx-muted mt-0.5 line-clamp-1">{s.description}</p>
                    )}

                    {/* Stats + barre */}
                    <div className="mt-3 flex items-center gap-4">
                      <div className="text-xs text-tx-muted">
                        <span className="font-semibold text-tx">{s.nb_tirages}</span> élèves tirés
                      </div>
                      <div className="text-xs text-tx-muted">
                        <span className="font-semibold text-success">{s.nb_evalues}</span> évalués
                      </div>
                      <div className="flex-1 max-w-[160px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-surface-alt overflow-hidden">
                            <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-bold text-tx-muted">{pct}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openDetail(s.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-brand bg-brand-soft rounded-lg hover:opacity-80 transition-opacity"
                    >
                      Voir les résultats
                    </button>
                    <button
                      onClick={() => setDeleteId(s.id)}
                      className="p-2 rounded-lg text-tx-muted hover:text-danger hover:bg-red-50 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal détail */}
      {detailId && (
        loadingDetail ? (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
            <div className="bg-surface rounded-2xl p-8 text-center">
              <p className="text-sm text-tx-muted">Chargement…</p>
            </div>
          </div>
        ) : detail ? (
          <SujetDetailModal sujet={detail} onClose={() => { setDetailId(null); setDetail(null); }} />
        ) : null
      )}

      {/* Modal suppression */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <p className="text-sm font-semibold text-tx mb-1">Supprimer ce sujet ?</p>
            <p className="text-xs text-tx-muted mb-5">
              Tous les tirages associés seront supprimés. Cette action est irréversible.
            </p>
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
