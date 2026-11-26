"use client";
// Lot L10 : comptes inspecteurs importés depuis l'onglet « Points_focaux » de
// la base de l'année (le même fichier que l'import global). Aperçu d'abord,
// puis création ; un point focal sans IEF n'est créé que si l'admin choisit
// son IEF.
import { useRef, useState } from "react";
import { inspecteursApi } from "@/lib/api";
import { errorDetail } from "@/lib/notify";

type Ligne = {
  pf: string; nom: string | null; telephone?: string | null; ief?: string;
  structure?: string | null; ief_proposee?: string | null; observation?: string | null; raison?: string;
};
type Resultat = {
  dry_run: boolean; lignes: number;
  crees: Ligne[]; mis_a_jour: Ligne[]; inchanges: Ligne[]; a_rattacher: Ligne[]; ignores: Ligne[];
};

export default function ImportPointsFocaux({ iefs, onClose, onDone }: {
  iefs: { ief: string; nb_ecoles: number }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState<Resultat | null>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [choix, setChoix] = useState<Record<string, string>>({});   // PF → IEF choisie ("" = laisser de côté)
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const envoyer = async (f: File, dryRun: boolean, c: Record<string, string>) => {
    setBusy(true); setErreur(null);
    try {
      const rattachements = Object.fromEntries(Object.entries(c).filter(([, v]) => v));
      const { data } = await inspecteursApi.importPointsFocaux(f, dryRun, rattachements);
      if (dryRun) {
        setApercu(data);
        // Proposition du fichier présélectionnée quand elle existe dans la liste des IEF.
        setChoix(prev => {
          const next = { ...prev };
          for (const l of data.a_rattacher as Ligne[]) {
            if (!(l.pf in next)) next[l.pf] = l.ief_proposee && iefs.some(o => o.ief === l.ief_proposee) ? l.ief_proposee : "";
          }
          return next;
        });
      } else {
        setResultat(data);
        onDone();
      }
    } catch (e) {
      setErreur(errorDetail(e) ?? "Import impossible. Aucun compte n'a été créé.");
    } finally {
      setBusy(false);
    }
  };

  const choisirFichier = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFichier(f); setApercu(null); setResultat(null); setChoix({});
    envoyer(f, true, {});
  };

  const nbACreer = (apercu?.crees.length ?? 0) + Object.values(choix).filter(Boolean).length;
  const r = resultat ?? apercu;

  const Liste = ({ titre, lignes, ton, detail }: { titre: string; lignes: Ligne[]; ton: string; detail: (l: Ligne) => string }) =>
    lignes.length === 0 ? null : (
      <div className="mb-3">
        <p className={`text-xs font-semibold mb-1 ${ton}`}>{titre} ({lignes.length})</p>
        {lignes.map(l => (
          <p key={l.pf} className="text-xs text-tx mb-0.5">
            <span className="text-tx-muted">{l.pf}</span> · <strong>{l.nom ?? "—"}</strong>
            {l.telephone ? ` · ${l.telephone}` : ""} · {detail(l)}
          </p>
        ))}
      </div>
    );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-base font-bold text-tx">Importer les inspecteurs (points focaux)</h2>
          <button onClick={onClose} className="text-tx-muted hover:text-tx text-lg leading-none" aria-label="Fermer">×</button>
        </div>
        <p className="text-sm text-tx-muted mb-4">
          Choisissez la base de l&apos;année (fichier « Base_acteurs_eleves… ») : seuls les comptes de l&apos;onglet
          « Points_focaux » sont lus. Rien n&apos;est créé avant votre confirmation. Les nouveaux inspecteurs se
          connectent avec leur numéro et le mot de passe temporaire habituel, à changer à la première connexion.
        </p>

        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={choisirFichier} />
        <button onClick={() => fileRef.current?.click()} disabled={busy}
          className="mb-4 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-tx hover:bg-surface-alt disabled:opacity-50">
          {busy && !apercu ? "Analyse…" : fichier ? `Fichier : ${fichier.name} (changer)` : "Choisir le fichier Excel"}
        </button>

        {erreur && <div className="mb-4 px-3 py-2 bg-danger-soft border border-danger/20 rounded-xl text-sm text-danger">{erreur}</div>}

        {r && (
          <div className="bg-bg rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-tx mb-3">
              {resultat ? "Import enregistré" : "Aperçu — rien n'est encore enregistré"} · {r.lignes} point(s) focal(aux) lu(s)
            </p>
            <Liste titre={resultat ? "Comptes créés" : "Comptes à créer"} lignes={r.crees} ton="text-success" detail={l => l.ief ?? ""} />
            <Liste titre={resultat ? "Comptes mis à jour" : "Comptes existants à mettre à jour"} lignes={r.mis_a_jour} ton="text-primary" detail={l => l.ief ?? ""} />
            <Liste titre="Déjà à jour" lignes={r.inchanges} ton="text-tx-muted" detail={l => l.ief ?? ""} />

            {!resultat && apercu && apercu.a_rattacher.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-tx mb-1">Sans IEF dans le fichier : choisissez-la ou laissez de côté ({apercu.a_rattacher.length})</p>
                {apercu.a_rattacher.map(l => (
                  <div key={l.pf} className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-xs text-tx flex-1 min-w-[220px]">
                      <span className="text-tx-muted">{l.pf}</span> · <strong>{l.nom ?? "—"}</strong> · {l.structure ?? ""}
                      {l.observation ? <span className="block text-tx-muted">{l.observation}</span> : null}
                    </span>
                    <select value={choix[l.pf] ?? ""} onChange={e => setChoix(c => ({ ...c, [l.pf]: e.target.value }))}
                      className="border border-border rounded-lg px-2 py-1.5 text-xs bg-surface text-tx">
                      <option value="">Laisser de côté</option>
                      {iefs.map(o => <option key={o.ief} value={o.ief}>{o.ief}{o.ief === l.ief_proposee ? " (proposée)" : ""}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <Liste titre="Ignorés" lignes={r.ignores} ton="text-warn" detail={l => l.raison ?? ""} />
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt">
            {resultat ? "Fermer" : "Annuler"}
          </button>
          {apercu && !resultat && (
            <button onClick={() => fichier && envoyer(fichier, false, choix)} disabled={busy || nbACreer + apercu.mis_a_jour.length === 0}
              className="px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-50">
              {busy ? "Création…" : `Créer ${nbACreer} compte(s)${apercu.mis_a_jour.length ? ` et mettre à jour ${apercu.mis_a_jour.length}` : ""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
