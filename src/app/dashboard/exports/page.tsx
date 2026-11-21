"use client";

/**
 * Centre d'exports analytiques (rapport V2, Partie II D6 / D9.2).
 * Archive ZIP complète du périmètre filtré : tables CSV liées par clés,
 * contrôle qualité, dictionnaire, manifeste et fichiers de compatibilité.
 * Pseudonymisé par défaut ; le mode nominatif est réservé aux administrateurs
 * et chaque export est journalisé (historique ci-dessous).
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AnalytiqueFiltresBar from "@/components/AnalytiqueFiltresBar";
import { analytiqueApi, type AnalytiqueFiltres, type ExportHistorique } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorDetail, notifyError } from "@/lib/notify";

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const fmtTaille = (o?: number) =>
  o === undefined ? "—" : o < 1024 * 1024 ? `${Math.max(1, Math.round(o / 1024))} Ko` : `${(o / 1024 / 1024).toFixed(1)} Mo`;

const TABLES_CLES = ["rapports_journaliers", "eleves", "absences_eleves", "difficultes_signalees", "evaluations", "seances"];

async function messageBlob(e: unknown): Promise<string | undefined> {
  // Une erreur sur une requête « blob » arrive elle-même en Blob : on la relit.
  const data = (e as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    try {
      const j = JSON.parse(await data.text());
      return typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch { /* ignoré */ }
  }
  return errorDetail(e);
}

export default function ExportsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [filtres, setFiltres] = useState<AnalytiqueFiltres>({ statut: "tous" });
  const [nominatif, setNominatif] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [historique, setHistorique] = useState<ExportHistorique[]>([]);
  const [dernier, setDernier] = useState<ExportHistorique | null>(null);

  const chargerHistorique = useCallback(async () => {
    try {
      const { data } = await analytiqueApi.historique();
      setHistorique(data);
      return data;
    } catch (e) {
      notifyError("Impossible de charger l'historique des exports.", e);
      return [];
    }
  }, []);

  useEffect(() => { chargerHistorique(); }, [chargerHistorique]);

  const exporter = async () => {
    if (nominatif && !window.confirm(
      "Export NOMINATIF : noms, textes libres et identifiants réels des élèves. " +
      "Réservé à un usage autorisé ; l'export est journalisé à votre nom. Continuer ?",
    )) return;
    setEnCours(true);
    try {
      const res = await analytiqueApi.exporter({ ...filtres, nominatif });
      const id = (res.headers["x-export-id"] as string | undefined) ?? "export";
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ndawwune_analytique_${id}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      const h = await chargerHistorique();
      setDernier(h.find(x => x.export_id === id) ?? null);
    } catch (e) {
      notifyError("L'export a échoué : aucune archive partielle n'a été produite.", { response: { data: { detail: await messageBlob(e) } } });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="p-7 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-tx mb-0.5">Centre d&apos;exports</h1>
          <p className="text-tx-muted text-sm max-w-3xl">
            Archive analytique complète du périmètre choisi, sans plafond d&apos;écran : une table CSV par unité
            d&apos;analyse, liées par identifiants, avec contrôle qualité, dictionnaire des variables et manifeste.
            Les anciens fichiers (Baseglobale, ElevesAbsents…) sont fournis dans <code>compat/</code>.
          </p>
        </div>
        <Link href="/dashboard/indicateurs" className="px-3 py-2 rounded-lg border border-border text-xs font-semibold text-tx hover:bg-surface-alt">
          ← Indicateurs du périmètre
        </Link>
      </div>

      <AnalytiqueFiltresBar value={filtres} onChange={setFiltres} />

      <div className="bg-surface border border-border rounded-2xl p-4 flex flex-wrap items-center gap-4">
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={!nominatif} onChange={() => setNominatif(false)} />
            <span><strong>Pseudonymisé</strong> <span className="text-tx-muted">— identifiants élèves opaques, sans noms ni textes libres</span></span>
          </label>
          <label className={`flex items-center gap-2 ${isAdmin ? "" : "opacity-50"}`} title={isAdmin ? "" : "Réservé aux administrateurs"}>
            <input type="radio" checked={nominatif} disabled={!isAdmin} onChange={() => setNominatif(true)} />
            <span><strong>Nominatif</strong> <span className="text-tx-muted">— administrateurs, journalisé</span></span>
          </label>
        </fieldset>
        <button onClick={exporter} disabled={enCours}
                className="ml-auto px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold disabled:opacity-50">
          {enCours ? "Préparation de l'archive…" : "Télécharger l'archive (.zip)"}
        </button>
      </div>

      {dernier && (
        <div className="bg-success-soft border border-border rounded-2xl p-4 text-sm">
          <p className="font-semibold text-success">Export {dernier.export_id} téléchargé</p>
          <p className="text-xs text-tx-muted mt-1">
            Données arrêtées au {fmtDate(dernier.borne_snapshot)} · {fmtTaille(dernier.taille_octets)} ·{" "}
            {dernier.anomalies ?? 0} anomalie(s) signalée(s) dans qualite_donnees.csv (aucune ligne supprimée)
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(dernier.lignes ?? {}).map(([t, n]) => (
              <span key={t} className="px-2 py-0.5 rounded-md bg-surface text-[11px] text-tx">{t} : <strong>{n}</strong></span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-tx-muted uppercase tracking-wide">Historique des exports</span>
          <button onClick={chargerHistorique} className="text-xs font-semibold text-brand hover:underline">Actualiser</button>
        </div>
        {historique.length === 0 ? (
          <p className="p-8 text-center text-sm text-tx-muted">Aucun export pour l&apos;instant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-tx-muted uppercase tracking-wide border-b border-border">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Par</th>
                  <th className="px-4 py-2.5">Mode</th>
                  <th className="px-4 py-2.5">Identifiant</th>
                  <th className="px-4 py-2.5">Lignes (tables principales)</th>
                  <th className="px-4 py-2.5">Anomalies</th>
                  <th className="px-4 py-2.5">Taille</th>
                </tr>
              </thead>
              <tbody>
                {historique.map((h, i) => (
                  <tr key={h.export_id ?? i} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-3 text-tx-muted whitespace-nowrap">{fmtDate(h.date)}</td>
                    <td className="px-4 py-3 text-tx">{h.par}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${h.mode === "nominatif" ? "bg-danger-soft text-danger" : "bg-surface-alt text-tx-muted"}`}>
                        {h.mode === "nominatif" ? "Nominatif" : "Pseudonymisé"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] font-mono text-tx-muted">{h.export_id}</td>
                    <td className="px-4 py-3 text-[11px] text-tx">
                      {TABLES_CLES.filter(t => h.lignes?.[t] !== undefined).map(t => `${t.replace(/_/g, " ")} ${h.lignes![t]}`).join(" · ")}
                    </td>
                    <td className="px-4 py-3 text-tx">{h.anomalies ?? "—"}</td>
                    <td className="px-4 py-3 text-tx-muted whitespace-nowrap">{fmtTaille(h.taille_octets)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
