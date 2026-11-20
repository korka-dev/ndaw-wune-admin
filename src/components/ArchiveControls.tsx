"use client";
/**
 * Archivage (rapport V2, APP-15) : « Supprimer » archive désormais. L'élément
 * disparaît des listes et de l'application terrain, son historique est conservé
 * et il peut être restauré. Briques partagées par les pages de gestion.
 */
import { useState } from "react";
import type { AxiosResponse } from "axios";
import { notifyError } from "@/lib/notify";

/** Libellés des compteurs renvoyés dans `historique_conserve`. */
const HISTORIQUE_LABELS: Record<string, [string, string]> = {
  // Clés renvoyées par app/services/archivage.py::historique (API)
  seances:              ["séance", "séances"],
  rapports_seance:      ["rapport de séance", "rapports de séance"],
  rapports_journaliers: ["rapport journalier", "rapports journaliers"],
  evaluations:          ["évaluation", "évaluations"],
  resultats_tirage:     ["résultat d'évaluation", "résultats d'évaluation"],
  tirages:              ["tirage d'évaluation", "tirages d'évaluation"],
  pointages:            ["pointage", "pointages"],
  remplacements:        ["remplacement", "remplacements"],
  eleves:               ["élève", "élèves"],
};

function formatHistorique(h: unknown): string {
  if (!h || typeof h !== "object") return "";
  const parts = Object.entries(h as Record<string, unknown>)
    .filter(([, n]) => typeof n === "number" && n > 0)
    .map(([k, n]) => {
      const lbl = HISTORIQUE_LABELS[k];
      const word = lbl ? lbl[(n as number) > 1 ? 1 : 0] : k.replace(/_/g, " ");
      return `${n} ${word}`;
    });
  return parts.length ? `Historique conservé : ${parts.join(", ")}.` : "";
}

type ArchiveOpts = { user?: boolean; extra?: string };

/** Conséquences d'un archivage, une ligne par point. */
export function archiveConsequences(opts?: ArchiveOpts): string[] {
  return [
    "Disparaît des listes et de l'application terrain.",
    ...(opts?.user ? ["Le compte est désactivé : plus aucune connexion possible."] : []),
    ...(opts?.extra ? [opts.extra] : []),
    "L'historique (séances, rapports, évaluations, pointages…) est conservé.",
    "Restauration possible à tout moment via « Afficher les archivés ».",
  ];
}

/** Texte de confirmation (window.confirm) : `what` = « cette école », « ce compte »… */
export function archiveConfirmText(what: string, opts?: ArchiveOpts): string {
  return `Archiver ${what} ?\n\n` + archiveConsequences(opts).map(l => `• ${l}`).join("\n");
}

/** Même contenu, pour les pages qui confirment dans une modale. */
export function ArchiveConsequences(opts: ArchiveOpts) {
  return (
    <ul className="list-disc pl-5 space-y-1 text-sm text-tx-muted">
      {archiveConsequences(opts).map(l => <li key={l}>{l}</li>)}
    </ul>
  );
}

export function formatArchivedAt(at: string): string {
  const d = new Date(at);
  return isNaN(d.getTime()) ? at : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Actions archiver / restaurer avec retour visible : message du serveur (et
 * historique conservé) en cas de succès, bandeau d'erreur sinon.
 */
export function useArchive(opts: {
  archive: (id: string) => Promise<AxiosResponse>;
  restore: (id: string) => Promise<AxiosResponse>;
  reload:  () => void;
}) {
  const [notice, setNotice] = useState("");

  /** `confirmText` : confirmation via window.confirm ; à omettre si la page a déjà confirmé (modale). */
  const archive = async (id: string, confirmText?: string): Promise<boolean> => {
    if (confirmText && !confirm(confirmText)) return false;
    try {
      const { data } = await opts.archive(id);
      const msg  = typeof data?.message === "string" && data.message ? data.message : "Élément archivé.";
      const hist = formatHistorique(data?.historique_conserve);
      setNotice(hist ? `${msg} ${hist}` : msg);
      opts.reload();
      return true;
    } catch (e) {
      notifyError("L'archivage a échoué.", e);
      return false;
    }
  };

  const restore = async (id: string): Promise<boolean> => {
    try {
      const { data } = await opts.restore(id);
      setNotice(typeof data?.message === "string" && data.message ? data.message : "Élément restauré.");
      opts.reload();
      return true;
    } catch (e) {
      notifyError("La restauration a échoué.", e);
      return false;
    }
  };

  return { notice, setNotice, archive, restore };
}

/** Message de succès après archivage / restauration. */
export function ArchiveNotice({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null;
  return (
    <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-lg bg-success-soft text-success rounded-xl px-4 py-3 text-sm shadow-lg flex gap-3 items-start">
      <span>{message}</span>
      <button onClick={onClose} className="font-bold" aria-label="Fermer">×</button>
    </div>
  );
}

export function ShowArchivedToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-tx-muted cursor-pointer select-none whitespace-nowrap">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-brand" />
      Afficher les archivés
    </label>
  );
}

export function ArchivedBadge({ at }: { at: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-alt text-tx-muted border border-border whitespace-nowrap">
      Archivé le {formatArchivedAt(at)}
    </span>
  );
}

export function RestoreButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="text-xs bg-success-soft text-success px-2.5 py-1 rounded-lg font-medium hover:bg-success hover:text-white transition-colors">
      Restaurer
    </button>
  );
}
