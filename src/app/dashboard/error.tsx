"use client";

/**
 * Plantage d'un écran du dashboard (rapport V2, APP-45 / APP-47) : au lieu
 * d'une page blanche, un message clair, un bouton « Réessayer » et une
 * référence support signalée automatiquement (sans contenu personnel).
 */
import { useEffect, useState } from "react";
import { signalerErreur } from "@/lib/support";

export default function ErreurEcran({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [reference, setReference] = useState<string | undefined>();

  useEffect(() => {
    signalerErreur({
      type: "ecran",
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
      message: `${error.name}${error.digest ? ` (${error.digest})` : ""}`,
    }).then(setReference);
  }, [error]);

  return (
    <div className="p-7">
      <div className="bg-surface border border-border rounded-2xl p-8 max-w-xl">
        <h1 className="text-lg font-bold text-tx mb-1">Cet écran n&apos;a pas pu s&apos;afficher</h1>
        <p className="text-sm text-tx-muted">
          Vos données enregistrées ne sont pas affectées. Réessayez ; si le problème persiste,
          transmettez la référence ci-dessous au support.
        </p>
        <p className="mt-3 text-xs font-mono text-tx-muted">Réf. support : {reference ?? "en cours…"}</p>
        <button onClick={reset} className="mt-5 px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold">
          Réessayer
        </button>
      </div>
    </div>
  );
}
