"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { comptesTerrainApi } from "@/lib/api";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

interface Compte {
  id: string;
  name: string;
  phone: string | null;
  role: "enseignant" | "superviseur";
  status: string;
  must_change_password: boolean;
  school?: { name: string; region?: string | null } | null;
}

const ROLE_LABEL: Record<Compte["role"], string> = {
  enseignant: "Tuteur",
  superviseur: "Superviseur",
};

function genererMotDePasse(): string {
  // Lisible à l'oral (pas de 0/O ni 1/l/I) — ce mot de passe est communiqué
  // verbalement ou par SMS à quelqu'un qui va le retaper sur son téléphone.
  const lettres = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const chiffres = "23456789";
  const pick = (s: string, n: number) =>
    Array.from({ length: n }, () => s[Math.floor(Math.random() * s.length)]).join("");
  return pick(lettres, 3) + pick(chiffres, 3) + pick(lettres, 2);
}

export default function IdentifiantsPage() {
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | "enseignant" | "superviseur">("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (v: string) => {
    setSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(v), 350);
  };

  // Modal de réinitialisation
  const [cible, setCible] = useState<Compte | null>(null);
  const [nouveauMdp, setNouveauMdp] = useState("");
  const [forcerChangement, setForcerChangement] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<{ nom: string; mdp: string } | null>(null);

  // Mots de passe visibles dans le tableau — UNIQUEMENT ceux que VOUS venez de
  // définir depuis cette page, en mémoire du navigateur seulement (jamais
  // envoyés au serveur, jamais écrits sur disque). Perdu au rechargement de la
  // page : c'est voulu, ce n'est pas un journal permanent.
  //
  // Les mots de passe déjà en base ne peuvent PAS apparaître ici : ils sont
  // hachés avec bcrypt (irréversible) dès leur création, y compris pour
  // l'équipe technique — voir le bandeau d'avertissement plus bas.
  const [mdpVisibles, setMdpVisibles] = useState<Record<string, string>>({});
  const [mdpMasque, setMdpMasque] = useState<Record<string, boolean>>({});

  const fetchComptes = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { skip: (p - 1) * PAGE_SIZE, limit: PAGE_SIZE };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (roleFilter) params.role = roleFilter;
      const res = await comptesTerrainApi.list(params);
      setComptes(res.data.items ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      setComptes([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, roleFilter]);

  useEffect(() => { fetchComptes(page); }, [fetchComptes, page]);
  useEffect(() => { setPage(1); }, [debouncedSearch, roleFilter]);

  const ouvrirModal = (c: Compte) => {
    setCible(c);
    setNouveauMdp(genererMotDePasse());
    setForcerChangement(false);
    setErreur(null);
  };

  const fermerModal = () => {
    setCible(null);
    setNouveauMdp("");
    setErreur(null);
  };

  const confirmerReset = async () => {
    if (!cible) return;
    if (nouveauMdp.trim().length < 6) {
      setErreur("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setSaving(true);
    setErreur(null);
    try {
      await comptesTerrainApi.resetPassword(cible.id, {
        new_password: nouveauMdp.trim(),
        force_change: forcerChangement,
      });
      setSucces({ nom: cible.name, mdp: nouveauMdp.trim() });
      setMdpVisibles(prev => ({ ...prev, [cible.id]: nouveauMdp.trim() }));
      setMdpMasque(prev => ({ ...prev, [cible.id]: false }));
      fermerModal();
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErreur(msg || "Impossible de définir ce mot de passe.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full flex-shrink-0 px-7 pb-7">
      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-bg pt-7 pb-4 mb-6 border-b border-border">
        <h1 className="text-xl font-bold text-tx">Identifiants tuteurs / superviseurs</h1>
        <p className="text-tx-muted text-sm mt-0.5">
          {loading ? "Chargement…" : `${total} compte${total !== 1 ? "s" : ""} au total`}
        </p>
      </div>

      {/* ── Avertissement : pourquoi les mots de passe ne sont pas affichés ─── */}
      <div className="flex gap-3 bg-warn-soft border border-warn/30 rounded-2xl px-4 py-3 mb-5 text-sm text-tx">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="text-warn flex-shrink-0 mt-0.5">
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
        <p>
          Les mots de passe sont chiffrés de façon irréversible (bcrypt) dès leur création — y
          compris pour l&apos;équipe technique. La colonne « Mot de passe » n&apos;affiche donc
          que ceux que <strong>vous</strong> venez de définir depuis cette page, le temps que
          l&apos;onglet reste ouvert. Pour un compte marqué « Chiffré », utilisez
          « Réinitialiser » pour lui en donner un nouveau.
        </p>
      </div>

      {/* ── Bandeau succès (mot de passe qui vient d'être défini) ────────────── */}
      {succes && (
        <div className="flex items-start justify-between gap-4 bg-brand-soft border border-brand/30 rounded-2xl px-4 py-3.5 mb-5">
          <div className="text-sm text-tx">
            <p className="font-semibold">Mot de passe de {succes.nom} mis à jour.</p>
            <p className="mt-1">
              Nouveau mot de passe :{" "}
              <code className="bg-surface border border-border rounded-lg px-2 py-1 font-mono font-bold text-brand">
                {succes.mdp}
              </code>
              <button
                onClick={() => navigator.clipboard?.writeText(succes.mdp)}
                className="ml-2 text-xs text-tx-muted hover:text-tx underline underline-offset-2"
              >
                Copier
              </button>
            </p>
            <p className="text-xs text-tx-muted mt-1">
              Communiquez-le maintenant — il ne sera plus affiché après avoir quitté cette page.
            </p>
          </div>
          <button onClick={() => setSucces(null)} className="text-tx-muted hover:text-tx flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Filtres ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
          {([
            { key: "", label: "Tous" },
            { key: "enseignant", label: "Tuteurs" },
            { key: "superviseur", label: "Superviseurs" },
          ] as const).map(opt => (
            <button
              key={opt.key || "all"}
              onClick={() => setRoleFilter(opt.key)}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                roleFilter === opt.key ? "bg-brand text-white" : "text-tx-muted hover:bg-surface-alt hover:text-tx"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text" value={search} onChange={e => handleSearchChange(e.target.value)}
            placeholder="Nom, téléphone ou école…"
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-9 py-2.5 text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
          />
          {search && (
            <button onClick={() => { setSearch(""); setDebouncedSearch(""); }} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tx-muted hover:text-tx">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Tableau ─────────────────────────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1">
        <table className="w-full text-sm table-fixed min-w-[900px]">
          <colgroup><col className="w-[20%]" /><col className="w-[11%]" /><col className="w-[13%]" /><col className="w-[17%]" /><col className="w-[17%]" /><col className="w-[8%]" /><col className="w-[14%]" /></colgroup>
          <thead className="sticky top-0 z-10 bg-surface-alt shadow-sm">
            <tr className="border-b border-border bg-surface-alt">
              {["Nom", "Rôle", "Téléphone", "École", "Mot de passe", "Statut", ""].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-tx-muted uppercase tracking-wide bg-surface-alt sticky top-0 z-10">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-16 text-center text-tx-muted text-sm">Chargement…</td></tr>
            ) : comptes.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-16 text-center text-tx-muted text-sm">
                {(search || roleFilter) ? "Aucun compte ne correspond aux filtres." : "Aucun compte pour l'instant."}
              </td></tr>
            ) : comptes.map(c => (
              <tr key={c.id} className="border-t border-border hover:bg-surface-alt transition-colors">
                <td className="px-4 py-3.5">
                  <span className="text-tx font-medium truncate block">{c.name}</span>
                  {c.must_change_password && (
                    <span className="text-[11px] text-warn">Doit changer son mot de passe</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    c.role === "enseignant" ? "bg-brand-soft text-brand" : "bg-surface-alt border border-border text-tx-muted"
                  }`}>
                    {ROLE_LABEL[c.role]}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-tx-muted text-xs">{c.phone || "—"}</td>
                <td className="px-4 py-3.5">
                  <span className="text-tx truncate block">{c.school?.name || "—"}</span>
                  {c.school?.region && <span className="text-tx-muted text-xs truncate block">{c.school.region}</span>}
                </td>
                <td className="px-4 py-3.5">
                  {mdpVisibles[c.id] ? (
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono text-xs text-tx bg-surface-alt border border-border rounded-lg px-2 py-1 truncate">
                        {mdpMasque[c.id] ? "••••••••" : mdpVisibles[c.id]}
                      </code>
                      <button
                        onClick={() => setMdpMasque(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                        title={mdpMasque[c.id] ? "Afficher" : "Masquer"}
                        className="text-tx-muted hover:text-tx flex-shrink-0"
                      >
                        {mdpMasque[c.id] ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a21.4 21.4 0 015.06-6.06M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a21.4 21.4 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => navigator.clipboard?.writeText(mdpVisibles[c.id])}
                        title="Copier"
                        className="text-tx-muted hover:text-tx flex-shrink-0"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-tx-muted text-xs italic">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                      Chiffré
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    c.status === "actif" ? "bg-brand-soft text-brand" : "bg-surface-alt text-tx-muted"
                  }`}>
                    {c.status === "actif" ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <button
                    onClick={() => ouvrirModal(c)}
                    className="text-xs font-semibold text-brand hover:underline underline-offset-2"
                  >
                    Réinitialiser
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {!loading && total > 0 && (
          <div className="border-t border-border px-5">
            <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
          </div>
        )}
      </div>

      {/* ── Modal réinitialisation ────────────────────────────────────────────── */}
      {cible && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
          onClick={e => { if (e.target === e.currentTarget) fermerModal(); }}
        >
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-tx">Réinitialiser le mot de passe</h2>
                <p className="text-sm text-tx-muted mt-0.5">
                  {cible.name} · {ROLE_LABEL[cible.role]}
                  {cible.phone ? ` · ${cible.phone}` : ""}
                </p>
              </div>
              <button onClick={fermerModal} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-alt text-tx-muted transition-colors flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-tx-muted uppercase tracking-wide">
                  Nouveau mot de passe
                </label>
                <div className="flex gap-2 mt-1.5">
                  <input
                    type="text"
                    value={nouveauMdp}
                    onChange={e => setNouveauMdp(e.target.value)}
                    className="flex-1 bg-surface border border-border rounded-xl px-3.5 py-2.5 text-sm font-mono text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
                    placeholder="Au moins 6 caractères"
                  />
                  <button
                    type="button"
                    onClick={() => setNouveauMdp(genererMotDePasse())}
                    title="Générer un nouveau mot de passe"
                    className="px-3 rounded-xl border border-border text-tx-muted hover:bg-surface-alt hover:text-tx transition-colors flex-shrink-0"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                  </button>
                </div>
                <p className="text-[11px] text-tx-muted mt-1.5">
                  Affiché en clair car c&apos;est vous qui le choisissez — communiquez-le au
                  tuteur ou au superviseur juste après.
                </p>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forcerChangement}
                  onChange={e => setForcerChangement(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-brand"
                />
                <span className="text-sm text-tx">
                  Demander d&apos;en choisir un autre à la prochaine connexion
                </span>
              </label>

              {erreur && (
                <p className="text-sm text-danger bg-danger-soft border border-danger/30 rounded-xl px-3.5 py-2.5">
                  {erreur}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button
                onClick={fermerModal}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-tx-muted hover:bg-surface-alt transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmerReset}
                disabled={saving || nouveauMdp.trim().length < 6}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
