"use client";

/**
 * Indicateurs unifiés (rapport V2, APP-36 et Partie II D7).
 * Chaque carte affiche l'unité, le numérateur / dénominateur, la population et
 * la date de fraîcheur. Un indicateur dont les données ne sont pas collectées
 * est affiché « non calculable » avec la raison, jamais approché (D4.4).
 * Les valeurs sont calculées par le serveur à partir du même snapshot que
 * l'archive CSV : elles se recalculent à l'identique depuis le pack (REC16).
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import AnalytiqueFiltresBar from "@/components/AnalytiqueFiltresBar";
import { analytiqueApi, type AnalytiqueFiltres, type Indicateur, type IndicateursReponse } from "@/lib/api";
import { notifyError } from "@/lib/notify";

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function valeur(i: Indicateur): string {
  if (i.valeur === null || i.valeur === undefined) return "—";
  if (typeof i.valeur === "number") {
    const n = i.valeur.toLocaleString("fr-FR");
    return i.unite.startsWith("%") ? `${n} %` : n;
  }
  return String(i.valeur);
}

function Detail({ d }: { d: Record<string, unknown> }) {
  const entrees = Object.entries(d);
  if (!entrees.length) return null;
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
      {entrees.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-tx-muted truncate" title={k}>{k.replace(/_/g, " ")}</dt>
          <dd className="text-tx text-right font-medium truncate" title={typeof v === "object" ? JSON.stringify(v) : String(v)}>
            {v === null ? "—" : typeof v === "object" ? Object.entries(v as Record<string, unknown>).map(([a, b]) => `${a} : ${b}`).join(" · ") : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Carte({ i }: { i: Indicateur }) {
  const [ouvert, setOuvert] = useState(false);
  const nc = i.statut === "non_calculable";
  return (
    <div className={`bg-surface border rounded-2xl p-4 flex flex-col ${nc ? "border-dashed border-border" : "border-border"}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-tx leading-snug">{i.libelle}</h3>
        {nc && <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-surface-alt text-tx-muted">Non calculable</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${nc ? "text-tx-muted" : "text-tx"}`}>{valeur(i)}</span>
        <span className="text-xs text-tx-muted">{i.unite}</span>
      </div>
      {nc ? (
        <p className="mt-2 text-xs text-tx-muted">{i.raison}</p>
      ) : (
        (i.numerateur !== null || i.denominateur !== null) && (
          <p className="mt-1 text-xs text-tx-muted">
            {i.numerateur ?? "—"} / {i.denominateur ?? "—"}
            {i.denominateur === 0 && " · aucune donnée à mesurer (pas 0 %)"}
          </p>
        )
      )}
      {i.population && <p className="mt-1 text-[11px] text-tx-muted">Population : {i.population}</p>}
      <button onClick={() => setOuvert(o => !o)} className="mt-auto pt-3 text-left text-[11px] font-semibold text-brand hover:underline">
        {ouvert ? "Masquer la définition" : "Définition et détail"}
      </button>
      {ouvert && (
        <div className="mt-2 border-t border-border pt-2">
          <p className="text-[11px] text-tx">{i.definition}</p>
          {i.sources.length > 0 && <p className="mt-1 text-[11px] text-tx-muted">Tables : {i.sources.join(", ")}</p>}
          <Detail d={i.detail} />
        </div>
      )}
    </div>
  );
}

export default function IndicateursPage() {
  const [filtres, setFiltres] = useState<AnalytiqueFiltres>({ statut: "tous" });
  const [data, setData] = useState<IndicateursReponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        setData((await analytiqueApi.indicateurs(filtres)).data);
      } catch (e) {
        notifyError("Impossible de calculer les indicateurs.", e);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [filtres]);

  const calcules = data?.indicateurs.filter(i => i.statut !== "non_calculable") ?? [];
  const nonCalc = data?.indicateurs.filter(i => i.statut === "non_calculable") ?? [];

  return (
    <div className="p-7 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-tx mb-0.5">Indicateurs</h1>
          <p className="text-tx-muted text-sm max-w-3xl">
            Indicateurs calculés côté serveur selon les définitions proposées par le rapport (à valider par ARED).
            Les rapports annulés sont exclus ; les manquants ne sont jamais comptés comme zéro.
          </p>
        </div>
        <Link href="/dashboard/exports" className="px-3 py-2 rounded-lg border border-border text-xs font-semibold text-tx hover:bg-surface-alt">
          Exporter ce périmètre →
        </Link>
      </div>

      <AnalytiqueFiltresBar value={filtres} onChange={setFiltres} />

      <div className="flex flex-wrap gap-4 text-xs text-tx-muted">
        <span>Données à jour au : <strong className="text-tx">{fmtDate(data?.fraicheur)}</strong></span>
        <span>Calcul du : <strong className="text-tx">{fmtDate(data?.borne_snapshot)}</strong></span>
        {data && <span>Schéma v{data.schema_version}</span>}
        {loading && <span>Calcul en cours…</span>}
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {calcules.map(i => <Carte key={i.code} i={i} />)}
          </div>
          {nonCalc.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-tx mb-2">Non calculables avec les données collectées</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {nonCalc.map(i => <Carte key={i.code} i={i} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
